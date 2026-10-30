(ns calva.repl.webview.ui
  (:require
   [calva.repl.webview.app-db :as app-db]
   [calva.repl.webview.error-element :as error-element]
   [calva.repl.webview.html :as html]
   [calva.repl.webview.images :as images]
   [calva.repl.webview.tooltip :as tooltip]
   [cljs.reader :as reader]
   [clojure.string :as str]
   [garden.core :as garden]
   ["strip-ansi" :default strip-ansi]
   ["highlightjs-copy" :as CopyButtonPlugin]
   ["highlight.js/lib/core" :as hljs]
   ["highlight.js/lib/languages/clojure" :as clojure]))

;; The DOM element where output is written
(def output-dom-element (js/document.getElementById "output"))

(defonce ^:private !lazy-raw-entries (atom []))

(defn ensure-dom-content-loaded
  "Ensures the DOM is ready before executing the callback"
  [callback]
  (if (= "complete" js/document.readyState)
    (callback)
    (js/document.addEventListener "DOMContentLoaded" callback #js {:once true})))

(defn throttle-fn
  "Returns a throttled version of the function, which will only be called at most once every `wait`
   milliseconds with the arguments passed in the latest call.

   If the throttled function is called again during the wait period, it will not execute until the wait period has
   passed, after which it will only be called once, no matter how many times it was called during the wait.
   If the throttled function is called again after the wait period, it will execute immediately."
  [f wait]
  (let [timeout (atom nil)
        called-during-timeout? (atom false)]
    (fn [& args]
      (if-not @timeout
        (do (apply f args)
            (reset! timeout (js/setTimeout (fn []
                                             (reset! timeout nil)
                                             (when @called-during-timeout?
                                               (reset! called-during-timeout? false)
                                               (apply f args)))
                                           wait)))
        (reset! called-during-timeout? true)))))

(defn scroll-to-bottom
  "Scrolls to the bottom of the the given dom element."
  []
  (js/scrollTo 0 js/document.documentElement.scrollHeight))

;; This can be adjusted if needed to avoid performance issues with too frequent scrolling.
(def throttled-scroll-to-bottom (throttle-fn scroll-to-bottom 0))

(defn output-appended-event
  "Creates a custom event to signal that output has been appended to the output DOM element.
   The event contains the `:container-element` in its detail."
  [container-element]
  (js/CustomEvent. "output-appended" #js {:detail {:container-element container-element}}))

(defn insert-hiccup!
  "Inserts the element of `hiccup` at `position` of `element`, `\"beforeend\"` or `\"afterend\"`, as
   `insertAdjacentHTML` does, and returns the inserted element."
  [^js element position hiccup]
  (.insertAdjacentHTML element position (html/render hiccup))
  (case position
    "beforeend" (.-lastElementChild element)
    "afterend" (.-nextElementSibling element)))

(defn clojure-code-element
  "Returns the hiccup of a `pre` with `clojure-code`, classed for highlight.js."
  [clojure-code]
  [:pre [:code {:class ["language-clojure"]} clojure-code]])

(defn highlight-code!
  [^js code-element]
  (.. hljs (highlightElement code-element)))

(defn- highlight-clojure-code!
  "Colors the Clojure code in `element`."
  [^js element]
  (run! highlight-code! (.querySelectorAll element "code.language-clojure")))

(defn evaluated-code-element
  "Returns the hiccup of evaluated `code`, under its label."
  [code]
  [:div {:class ["evaluated-code-container"]}
   [:span {:class ["border-text"]} "Evaluated code"]
   (clojure-code-element code)])

(defn append-evaluated-code
  "Appends evaluated code to the given dom element."
  [^js dom-element output]
  (let [element (insert-hiccup! dom-element "beforeend" (evaluated-code-element output))]
    (highlight-clojure-code! element)
    (.. dom-element (dispatchEvent (output-appended-event element)))))

(defn append-eval-result
  [^js dom-element output]
  (let [element (insert-hiccup! dom-element "beforeend" (clojure-code-element output))]
    (highlight-clojure-code! element)
    (.. dom-element (dispatchEvent (output-appended-event element)))))

(defn create-element
  [tag class-name text]
  (let [element (js/document.createElement tag)]
    (.. element -classList (add class-name))
    (when text
      (.. element (appendChild (js/document.createTextNode text))))
    element))

(defn data-url-blob
  [data-url mime]
  (let [binary (js/atob (subs data-url (inc (str/index-of data-url ","))))
        bytes (js/Uint8Array. (count binary))]
    (dotimes [i (count binary)]
      (aset bytes i (.charCodeAt binary i)))
    (js/Blob. #js [bytes] #js {:type mime})))

(defn png-blob
  "A promise of `img` drawn on a canvas, as a PNG blob."
  [^js img]
  (js/Promise.
   (fn [resolve reject]
     (let [canvas (js/document.createElement "canvas")]
       (set! (.-width canvas) (if (pos? (.-naturalWidth img)) (.-naturalWidth img) (.-width img)))
       (set! (.-height canvas) (if (pos? (.-naturalHeight img)) (.-naturalHeight img) (.-height img)))
       (.. canvas (getContext "2d") (drawImage img 0 0 (.-width canvas) (.-height canvas)))
       (.. canvas (toBlob #(if % (resolve %) (reject (js/Error. "The image cannot be drawn as PNG")))
                          "image/png"))))))

(defn show-copied!
  [^js button]
  (when-let [pending (.-calvaCopyRestoreTimeout button)]
    (js/clearTimeout pending))
  (set! (.. button -dataset -copied) "true")
  (.setAttribute button "aria-label" "Copied to clipboard")
  (set! (.-calvaCopyRestoreTimeout button)
        (js/setTimeout #(do (set! (.-calvaCopyRestoreTimeout button) nil)
                            (set! (.. button -dataset -copied) "false")
                            (when-let [original (.getAttribute button "data-copy-label")]
                              (.setAttribute button "aria-label" original)))
                       1500)))

(defn- copy-text!
  "Writes `text` to the clipboard and marks `button`, if any, as copied. Must run in a click
   handler: the clipboard write needs the user activation."
  [^js button text]
  (-> (.. js/navigator -clipboard (writeText text))
      (.then #(some-> button show-copied!))
      (.catch #(js/console.error "Cannot copy to the clipboard:" %))))

(defn- stdout-copy-button
  "A Copy output button for the stdout element `pre-element`, copying all of its text."
  [^js pre-element]
  (let [button (create-element "button" "output-copy-button" nil)]
    (.. button -classList (add "output-stdout-copy"))
    (set! (.-type button) "button")
    (tooltip/attach! button "Copy output")
    (.. button (setAttribute "aria-label" "Copy output"))
    (.. button (setAttribute "data-copy-label" "Copy output"))
    (.. button (addEventListener "click" #(copy-text! button (.-textContent pre-element))))
    button))

(defn create-and-append-stdout-element
  "Creates a new stdout element, with a Copy output button, and appends it to the given DOM element."
  [dom-element text-node category]
  (let [pre-element (create-element "pre" "output-stdout" nil)]
    (.. pre-element (appendChild (stdout-copy-button pre-element)))
    (.. pre-element (appendChild text-node))
    (.. pre-element (setAttribute "data-output-element-type" (or category "evalOut")))
    (.. dom-element (appendChild pre-element))
    (.. dom-element (dispatchEvent (output-appended-event pre-element)))))

(defn append-stdout
  "Appends stdout content to the given DOM element, unless the last element is already a stdout element with the same category,
   in which case it appends the content to that element instead."
  [^js dom-element output category]
  (let [category (or category "evalOut")
        text-node (js/document.createTextNode (strip-ansi output))]
    (if-let [last-output-element (.. dom-element -lastElementChild)]
      (if (= category (.. last-output-element -dataset -outputElementType))
        (do
          (.. last-output-element (appendChild text-node))
          (.. dom-element (dispatchEvent (output-appended-event last-output-element))))
        (create-and-append-stdout-element dom-element text-node category))
      (create-and-append-stdout-element dom-element text-node category))))

(defonce vscode-api
  (when (exists? js/acquireVsCodeApi)
    (js/acquireVsCodeApi)))

(defonce !host-requests (atom {}))

(defn post-to-host!
  [message]
  (when vscode-api
    (.postMessage vscode-api (clj->js message :keyword-fn #(subs (str %) 1)))))

(defn- host-request-id
  []
  (str (random-uuid)))

(defn- remember-host-request!
  [id handler]
  (swap! !host-requests assoc id handler))

(defn- deliver-host-request!
  [id payload]
  (when-let [handler (get @!host-requests id)]
    (swap! !host-requests dissoc id)
    (handler payload)))

(defn copy-image!
  "Writes the image to the clipboard as PNG. Must run in the click handler: the clipboard write
   needs the user activation."
  [^js button ^js img {:image/keys [mime data-url kind src]}]
  (let [png (cond
              (and data-url (= "image/png" mime))
              (js/Promise.resolve (data-url-blob data-url mime))

              data-url
              (png-blob img)

              (= :remote kind)
              (js/Promise.
               (fn [resolve reject]
                 (let [id (host-request-id)]
                   (remember-host-request!
                    id
                    (fn [{:keys [base64 mime]}]
                      (if-not base64
                        (reject (js/Error. "Cannot fetch the image"))
                        (let [data-url (str "data:" mime ";base64," base64)]
                          (if (str/starts-with? (str mime) "image/png")
                            (resolve (data-url-blob data-url "image/png"))
                            (let [tmp (js/document.createElement "img")]
                              (set! (.-onload tmp)
                                    (fn []
                                      (-> (png-blob tmp) (.then resolve) (.catch reject))))
                              (set! (.-onerror tmp) #(reject (js/Error. "Cannot decode the image")))
                              (set! (.-src tmp) data-url)))))))
                   (post-to-host! {:command "fetch-image-for-copy" :id id :url src}))))

              :else
              (png-blob img))]
    (-> (.. js/navigator -clipboard (write #js [(js/ClipboardItem. #js {"image/png" png})]))
        (.then #(show-copied! button))
        (.catch #(js/console.error "Cannot copy the image to the clipboard:" %)))))

(defn- includes-remote-urls?
  []
  (= "images-including-remote-urls"
     (some-> js/document .-body (.getAttribute "data-image-display"))))

(defn- remove-thumbnail!
  "Removes `thumb` and, when that empties the `.output-images` row, removes the row too."
  [^js thumb]
  (when-let [parent (.-parentNode thumb)]
    (.removeChild parent thumb)
    (when (zero? (.-childElementCount parent))
      (when-let [grandparent (.-parentNode parent)]
        (.removeChild grandparent parent)))))

(defn- hide-until-load!
  [^js thumb ^js img]
  (set! (.. thumb -dataset -pending) "true")
  (.addEventListener img "load"
                     (fn []
                       (set! (.. thumb -dataset -pending) "false"))
                     #js {:once true})
  (.addEventListener img "error"
                     (fn []
                       (remove-thumbnail! thumb))
                     #js {:once true}))

(defn- raw-display?
  []
  (= "raw" (some-> js/document .-body (.getAttribute "data-image-display"))))

(def max-local-image-lookups
  "Cap on in-flight local image lookups keyed by request id."
  64)

(defonce ^:private !local-image-lookups (atom {}))

(defonce ^:private !local-image-src->id (atom {}))

(defonce ^:private !pending-local-images (atom []))

(defn- apply-local-resolve!
  [^js img ^js thumbnail webview-uri]
  (if webview-uri
    (do (set! (.-src img) webview-uri)
        (.setAttribute img "src" webview-uri))
    (remove-thumbnail! thumbnail)))

(defn- clear-local-image-lookups!
  "Drops in-flight local image waiters and their host-request handlers."
  []
  (let [ids (keys @!local-image-lookups)]
    (reset! !local-image-lookups {})
    (reset! !local-image-src->id {})
    (swap! !host-requests #(apply dissoc % ids))))

(defn- local-image-lookup-key
  "Coalesce key for in-flight local lookups: path plus producing session key."
  [src session-key]
  [src session-key])

(defn- start-local-image-lookup!
  "Posts one host lookup for `src` and stores waiters under the request id."
  [^js img ^js thumbnail src session-key]
  (let [id (host-request-id)
        lookup-key (local-image-lookup-key src session-key)]
    (swap! !local-image-src->id assoc lookup-key id)
    (swap! !local-image-lookups assoc id {:src src
                                          :session-key session-key
                                          :waiters [[img thumbnail]]})
    (remember-host-request!
     id
     (fn [{:keys [webview-uri]}]
       (when-let [entry (get @!local-image-lookups id)]
         (swap! !local-image-lookups dissoc id)
         (swap! !local-image-src->id
                dissoc
                (local-image-lookup-key (:src entry) (:session-key entry)))
         (doseq [[img thumbnail] (:waiters entry)]
           (apply-local-resolve! img thumbnail webview-uri)))))
    (post-to-host! (cond-> {:command "resolve-local-image" :id id :src src}
                     session-key (assoc :sessionKey session-key)))))

(defn- resolve-local-image!
  "Asks the host for a webview URI for an image file path. Waiters are keyed by request id so a
   late reply cannot consume a newer lookup for the same src. Identical paths from the same
   session coalesce onto one in-flight id while that lookup is open."
  [^js img ^js thumbnail src session-key]
  (if-let [existing-id (get @!local-image-src->id (local-image-lookup-key src session-key))]
    (swap! !local-image-lookups update-in [existing-id :waiters] conj [img thumbnail])
    (if (< (count @!local-image-lookups) max-local-image-lookups)
      (start-local-image-lookup! img thumbnail src session-key)
      (remove-thumbnail! thumbnail))))

(defn- queue-pending-local!
  [^js img ^js thumbnail src session-key]
  (swap! !pending-local-images conj {:img img :thumbnail thumbnail :src src :session-key session-key}))

(defn- img-src-unset?
  "True when `img` has no `src` attribute."
  [^js img]
  (str/blank? (or (.getAttribute img "src") "")))

(defn- flush-pending-local!
  []
  (let [pending @!pending-local-images]
    (reset! !pending-local-images [])
    (doseq [{:keys [img thumbnail src session-key]} pending]
      (when (and img (img-src-unset? img))
        (resolve-local-image! img thumbnail src session-key)))))

(defn create-image-element
  "A thumbnail (the full-resolution image, scaled down by CSS) with a copy image button.
   Data-URL, local, and remote images stay hidden until they load; a failure removes the thumbnail."
  [{:image/keys [data-url kind src session-key] :as image}]
  (let [label (images/label image)
        thumbnail (create-element "div" "output-image-thumbnail" nil)
        img (create-element "img" "output-image" nil)
        button (create-element "button" "output-copy-button" nil)]
    (.. button -classList (add "output-image-copy"))
    (set! (.-alt img) label)
    (set! (.-title img) label)
    (when kind
      (set! (.. img -dataset -imageKind) (name kind))
      (set! (.. thumbnail -dataset -imageKind) (name kind)))
    (set! (.-type button) "button")
    (tooltip/attach! button "Copy image")
    (.. button (setAttribute "aria-label" (str "Copy " label)))
    (.. button (setAttribute "data-copy-label" (.getAttribute button "aria-label")))
    (.. button (addEventListener "click" #(copy-image! button img image)))
    (.. thumbnail (appendChild img))
    (.. thumbnail (appendChild button))
    (cond
      data-url (do (hide-until-load! thumbnail img)
                   (set! (.-src img) data-url))
      (= :local kind) (do (hide-until-load! thumbnail img)
                          (set! (.-calvaLocalSrc img) src)
                          (if (raw-display?)
                            (queue-pending-local! img thumbnail src session-key)
                            (resolve-local-image! img thumbnail src session-key)))
      (= :remote kind) (do (set! (.-calvaRemoteSrc img) src)
                           (hide-until-load! thumbnail img)
                           (when (includes-remote-urls?)
                             (set! (.-src img) src)))
      :else (when src (set! (.-src img) src)))
    thumbnail))

(declare create-image-form-element)

(defn- ensure-raw-form!
  "Builds the raw form on `entry` once, when a builder is still attached."
  [^js entry]
  (when-let [create-raw-el! (.-calvaCreateRawEl! entry)]
    (set! (.-calvaCreateRawEl! entry) nil)
    (.. entry (appendChild (create-image-form-element "raw" [(create-raw-el!)])))))

(defn- attach-raw-form!
  [^js entry create-raw-el!]
  (set! (.-calvaCreateRawEl! entry) create-raw-el!)
  (if (raw-display?)
    (ensure-raw-form! entry)
    (swap! !lazy-raw-entries conj entry)))

(defn create-image-form-element
  [image-form children]
  (let [element (js/document.createElement "div")]
    (.. element (setAttribute "data-image-form" image-form))
    (run! #(.. element (appendChild %)) children)
    element))

(defn- append-segments!
  "Appends each text segment and the images that belong directly below it. Returns the img elements
   so the caller can listen for load."
  [^js parent segments create-text-el!]
  (reduce
   (fn [imgs {:keys [text images]}]
     (when (seq text)
       (.. parent (appendChild (create-text-el! text))))
     (if (seq images)
       (let [wrap (create-element "div" "output-images" nil)
             thumbs (mapv create-image-element images)]
         (run! #(.. wrap (appendChild %)) thumbs)
         (.. parent (appendChild wrap))
         (into imgs (keep (fn [^js thumb]
                            (first (filter (fn [^js child]
                                             (= "IMG" (.-tagName child)))
                                           (.-children thumb))))
                          thumbs)))
       imgs))
   []
   segments))

(defn- listen-for-image-load!
  [^js dom-element img-elements]
  (run! (fn [^js img]
          (.. img (addEventListener "load"
                                    #(.. dom-element (dispatchEvent (output-appended-event img)))
                                    #js {:once true})))
        img-elements))

(defn append-with-images!
  "Appends an output entry that has images. The images form is built now. The raw form is built
   when the display is already raw, or later when it switches to raw. The entry is appended before
   the raw form is built, so a throw while building the raw form cannot drop the whole entry.
   Returns the entry element."
  [^js dom-element {:keys [text images create-raw-el! create-text-el!]}]
  (let [entry (create-element "div" "output-with-images" nil)
        images-form (js/document.createElement "div")]
    (.. images-form (setAttribute "data-image-form" "images"))
    (listen-for-image-load!
     dom-element
     (append-segments! images-form (images/segments-with-images text images) create-text-el!))
    (.. entry (setAttribute "data-output-element-type" "images"))
    (.. entry (appendChild images-form))
    (.. dom-element (appendChild entry))
    (attach-raw-form! entry create-raw-el!)
    entry))

(defn append-result-with-images
  [^js dom-element {:keys [text raw images meta]}]
  (let [session-key (or (:meta/repl-session-key meta) (:repl-session-key meta))
        images (mapv #(cond-> % session-key (assoc :image/session-key session-key)) images)
        code-el! (fn [code]
                   (doto (insert-hiccup! (js/document.createElement "div") "beforeend" (clojure-code-element code))
                     highlight-clojure-code!))
        entry (append-with-images! dom-element
                                   {:text text
                                    :images images
                                    :create-raw-el! #(code-el! raw)
                                    :create-text-el! code-el!})]
    (.. dom-element (dispatchEvent (output-appended-event entry)))))

(defn session-str
  [{:meta/keys [repl-session-key shadow-build shadow-runtime-id]}]
  (let [parts (cond-> []
                repl-session-key (conj (str repl-session-key))
                shadow-build (conj (str shadow-build))
                (some? shadow-runtime-id) (conj (str shadow-runtime-id)))]
    (str/join " " parts)))

(defn ns-info-element
  "Returns the hiccup of the badges of who evaluated, in which session and namespace. The REPL
   Input's evaluations, from `\"ui\"`, get no who badge."
  [{:meta/keys [who ns] :as meta-data}]
  (let [sess (session-str meta-data)]
    [:div {:class ["ns-info-container"] :data-output-element-type "ns-info"}
     (when (and who (not= who "ui"))
       [:span {:class ["ns-info-badge" "ns-info-who"]} who])
     (when (seq sess)
       [:span {:class ["ns-info-badge" "ns-info-session"]} sess])
     (when ns
       [:span {:class ["ns-info-badge" "ns-info-ns"]} ns])]))

(defn append-ns-info
  [^js dom-element meta-data]
  (let [ns-info-el (insert-hiccup! dom-element "beforeend" (ns-info-element meta-data))]
    (.. dom-element (dispatchEvent (output-appended-event ns-info-el)))))

(defn clear-output-dom
  [^js output-dom-element]
  (reset! !lazy-raw-entries [])
  (reset! !pending-local-images [])
  (clear-local-image-lookups!)
  (set! (.-innerHTML output-dom-element) ""))

(defn update-theme-of-copy-buttons
  []
  (.. (js/document.querySelectorAll "div.hljs-copy-container")
      (forEach (fn [^js copy-container-node]
                 (let [parent-node (.. copy-container-node -parentNode)
                       hljs-code-node (.. parent-node (querySelector "code.hljs"))
                       code-computed-style (js/getComputedStyle hljs-code-node)
                       code-background-color (.-backgroundColor code-computed-style)
                       code-foreground-color (.-color code-computed-style)
                       code-padding (.-padding code-computed-style)]
                   (.. copy-container-node -style (setProperty "--hljs-theme-background" code-background-color))
                   (.. copy-container-node -style (setProperty "--hljs-theme-color" code-foreground-color))
                   (.. copy-container-node -style (setProperty "--hljs-theme-padding" code-padding)))))))

(defn set-code-theme!
  [code-theme]
  (let [code-theme-link-nodes (js/document.querySelectorAll "[data-code-theme]")]
    (.. code-theme-link-nodes (forEach (fn [^js node]
                                         (let [current-code-theme (.. node -dataset -codeTheme)]
                                           (if (= current-code-theme code-theme)
                                             (.. node (removeAttribute "disabled"))
                                             (.. node (setAttribute "disabled" "disabled")))))))
    ;; The timeout seems to prevent an issue where the copy buttons lose some of their styles on theme change.
    (js/setTimeout update-theme-of-copy-buttons 100)))

(defn token-colors-css
  "Returns CSS that gives each highlight.js scope in `colors` its color, over the code theme's."
  [colors]
  (garden/css (for [[scope color] colors]
                [(str ":root .hljs-" scope) {:color color}])))

(defonce !token-colors-sheet (atom nil))

(defn- token-colors-sheet
  []
  (or @!token-colors-sheet
      (let [sheet (js/CSSStyleSheet.)]
        (set! (.-adoptedStyleSheets js/document) (.concat (.-adoptedStyleSheets js/document) #js [sheet]))
        (reset! !token-colors-sheet sheet))))

(defn set-token-colors!
  [colors]
  (.replaceSync ^js (token-colors-sheet) (token-colors-css colors)))

(defn set-word-wrap!
  [word-wrap]
  (let [body js/document.body]
    (if word-wrap
      (.. body -classList (add "word-wrap"))
      (.. body -classList (remove "word-wrap")))))

(defn- apply-remote-src!
  [image-display]
  (when (fn? (.-querySelectorAll js/document))
    (let [imgs (.querySelectorAll js/document "img[data-image-kind=\"remote\"]")]
      (.forEach imgs
                (fn [^js img]
                  (when (and (= "images-including-remote-urls" image-display)
                             (.-calvaRemoteSrc img)
                             (str/blank? (str (.-src img))))
                    (set! (.-src img) (.-calvaRemoteSrc img))))))))

(defn- apply-local-src!
  "When leaving raw, resolve local images that were queued while in raw mode."
  [image-display]
  (when-not (= "raw" image-display)
    (flush-pending-local!)))

(defn set-image-display!
  [image-display]
  (some-> js/document .-body (.setAttribute "data-image-display" image-display))
  (when (= "raw" image-display)
    (let [entries @!lazy-raw-entries]
      (reset! !lazy-raw-entries [])
      (run! ensure-raw-form! entries)))
  (apply-remote-src! image-display)
  (apply-local-src! image-display))

(defn set-font-scale!
  [scale]
  (.. js/document -documentElement -style (setProperty "--calva-output-font-scale" (str scale))))

(defonce !effect-handlers (atom {}))

(defn register-effect-handler!
  "Registers `handler` for the effects with the keyword namespace `effect-ns`. It is called with
   `dispatch!` and the effect."
  [effect-ns handler]
  (swap! !effect-handlers assoc effect-ns handler))

(defn- focused-control
  [^js element]
  (when (and element (.contains element js/document.activeElement))
    (.. js/document -activeElement (getAttribute "data-control"))))

(defn render-error!
  "Draws `error`, in place of its earlier element if there is one, keeping focus on the control
   that had it."
  [^js dom-element dispatch {:error/keys [id] :as error}]
  (let [new-element (error-element/create error dispatch)
        ^js existing (.querySelector dom-element (str "[data-error-id=\"" id "\"]"))]
    (if existing
      (let [control (focused-control existing)]
        (.replaceWith existing new-element)
        (some-> (.querySelector new-element (str "[data-control=\"" control "\"]")) .focus))
      (do (.. dom-element (appendChild new-element))
          (.. dom-element (dispatchEvent (output-appended-event new-element)))))))

(defn- copy-error-text!
  "Writes `text` to the clipboard and marks the error's copy button as copied. Runs in the click's
   dispatch: the clipboard write needs the user activation."
  [^js dom-element {:error/keys [id] :copy/keys [text]}]
  (copy-text! (.querySelector dom-element (str "[data-error-id=\"" id "\"] [data-control=\"copy\"]"))
              text))

(declare dispatch!)

(defn exec-effect!
  [^js output-dom-element [fx-type & args :as effect]]
  (case fx-type
    :fx/append-ns-info (append-ns-info output-dom-element (first args))
    :fx/append-result (append-eval-result output-dom-element (first args))
    :fx/append-evaluated-code (append-evaluated-code output-dom-element (first args))
    :fx/append-stdout (append-stdout output-dom-element (first args) (second args))
    :fx/append-result-with-images (append-result-with-images output-dom-element (first args))
    :fx/render-error (render-error! output-dom-element dispatch! (first args))
    :fx/post-to-host (post-to-host! (first args))
    :fx/copy-error-text (copy-error-text! output-dom-element (first args))
    :fx/clear-dom (clear-output-dom output-dom-element)
    :fx/set-code-theme (set-code-theme! (first args))
    :fx/set-token-colors (set-token-colors! (first args))
    :fx/set-word-wrap (set-word-wrap! (first args))
    :fx/set-image-display (set-image-display! (first args))
    :fx/set-font-scale (set-font-scale! (first args))
    (if-let [handler (get @!effect-handlers (namespace fx-type))]
      (handler dispatch! effect)
      (js/console.error "No handler for effect" (str fx-type)))))

(defn dispatch!
  [action]
  (let [current-db @app-db/!app-db
        {:uf/keys [db fxs dxs]} (app-db/handle-action current-db action)]
    (when (and db (not= db current-db))
      (reset! app-db/!app-db db))
    (run! #(exec-effect! output-dom-element %) fxs)
    (run! dispatch! dxs)))

(defn ^:export clear-output-view
  []
  (dispatch! [:msg/clear-output-view]))

(defn handle-message
  [^js message]
  (ensure-dom-content-loaded
   (fn []
     (let [message-data (reader/read-string (.-data message))
           command-name (:command/name message-data)]
       (case command-name
         "clear-output-view"    (dispatch! [:msg/clear-output-view])
         "set-code-theme"       (dispatch! [:msg/set-code-theme message-data])
         "set-word-wrap"        (dispatch! [:msg/set-word-wrap message-data])
         "set-base-font-scale"  (dispatch! [:msg/set-base-font-scale message-data])
         "adjust-font-size"     (dispatch! [:msg/adjust-font-size message-data])
         "reset-font-size"      (dispatch! [:msg/reset-font-size message-data])
         "set-image-display"    (dispatch! [:msg/set-image-display message-data])
         "local-image-resolved" (deliver-host-request! (:id message-data) message-data)
         "local-image-missing"  (deliver-host-request! (:id message-data) message-data)
         "image-bytes"          (deliver-host-request! (:id message-data) message-data)
         "image-bytes-missing"  (deliver-host-request! (:id message-data) message-data)
         "repl-input-enabled"   (dispatch! [:repl-input/ax.set-enabled (:repl-input/enabled? message-data)])
         "repl-input-edit"      (dispatch! [:repl-input/ax.edit message-data])
         "repl-input-command-keys" (dispatch! [:repl-input/ax.set-command-keys (:repl-input/command-keys message-data)])
         "repl-input-brackets"  (dispatch! [:repl-input/ax.set-brackets message-data])
         "repl-input-editor-settings" (dispatch! [:repl-input/ax.set-editor-settings (:repl-input/editor-settings message-data)])
         "repl-input-run-command" (dispatch! [:repl-input/ax.run-command (:repl-input/command message-data)])
         "repl-input-context"   (dispatch! [:repl-input/ax.set-context-line (:repl-input/context-line message-data)])
         "repl-input-evaluation" (dispatch! [:repl-input/ax.set-evaluation (:repl-input/evaluation message-data)])
         "repl-input-focus"     (dispatch! [:repl-input/ax.focus])
         "repl-input-not-last-focused" (dispatch! [:repl-input/ax.not-last-focused])
         "repl-input-completions" (dispatch! [:repl-input/ax.completions message-data])
         "repl-input-completion-docs" (dispatch! [:repl-input/ax.completion-docs message-data])
         "repl-input-history"   (dispatch! [:repl-input/ax.set-history (:repl-input.history/entries message-data)])
         "repl-input-recall"    (dispatch! [:repl-input/ax.recall (:repl-input.history/position message-data)])
         ("show-result" "show-evaluated-code" "show-stdout")
         (dispatch! [:msg/output message-data])
         "show-error"           (dispatch! [:msg/error message-data])
         "show-error-causes"    (dispatch! [:msg/error-causes message-data])
         (js/console.error "No handler for message" (str command-name)))))))

(defn handle-output-appended
  [^js _event]
  (throttled-scroll-to-bottom))

(defn add-event-listeners
  [^js output-dom-element]
  (.. js/window (addEventListener "message" handle-message))
  (.. output-dom-element (addEventListener "output-appended" handle-output-appended)))

(defn ^:export main []
  (add-event-listeners output-dom-element)
  (.. hljs (registerLanguage "clojure" clojure))
  (ensure-dom-content-loaded (fn []
                               (.. hljs (addPlugin (CopyButtonPlugin. #js {:autohide true})))
                               ;; Added after the copy plugin, which adds the button it gives a tooltip
                               (.. hljs (addPlugin #js {"after:highlightElement"
                                                        (fn [^js result]
                                                          (some-> (.. result -el -parentElement (querySelector ".hljs-copy-button"))
                                                                  (tooltip/attach! "Copy")))})))))
