(ns calva.repl.webview.ui
  (:require
   [calva.repl.webview.app-db :as app-db]
   [calva.repl.webview.auto-scroll :as auto-scroll]
   [calva.repl.webview.code-brackets :as code-brackets]
   [calva.repl.webview.code-highlight :as code-highlight]
   [calva.repl.webview.copy-button :as copy-button]
   [calva.repl.webview.error-element :as error-element]
   [calva.repl.webview.html :as html]
   [calva.repl.webview.images :as images]
   [calva.repl.webview.input.highlight :as highlight]
   [calva.repl.webview.keybindings-note :as keybindings-note]
   [calva.repl.webview.printed-code.editor :as printed-code-editor]
   [calva.repl.webview.spinner :as spinner]
   [calva.repl.webview.tooltip :as tooltip]
   [calva.repl.webview.viewport-observer :as viewport-observer]
   [cljs.reader :as reader]
   [clojure.string :as str]
   [clojure.walk :as walk]
   ["strip-ansi" :default strip-ansi]))

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
   passed, after which it will only be called once, no matter how many times it was called during the wait, and
   a new wait period starts. If the throttled function is called again after the wait period, it will execute
   immediately."
  [f wait]
  (let [timeout (atom nil)
        pending-args (atom nil)]
    (letfn [(start-wait! []
              (reset! timeout (js/setTimeout (fn []
                                               (reset! timeout nil)
                                               (when-let [args @pending-args]
                                                 (reset! pending-args nil)
                                                 (apply f args)
                                                 (start-wait!)))
                                             wait)))]
      (fn [& args]
        (if @timeout
          (reset! pending-args (vec args))
          (do (apply f args)
              (start-wait!)))))))

;; This can be adjusted if needed to avoid performance issues with too frequent scrolling.
(def throttled-scroll-to-bottom (throttle-fn auto-scroll/follow! 0))

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

(defn- stdout-run
  "Returns the stdout blocks of the run `block` is in: the block that starts it, and the blocks that continue it."
  [^js block]
  (let [continues? #(some-> ^js % (.hasAttribute "data-continues"))
        start (loop [^js b block]
                (if (continues? b) (recur (.-previousElementSibling b)) b))]
    (cons start (take-while continues? (rest (iterate #(.-nextElementSibling ^js %) start))))))

(defn- copy-stdout!
  "Copies the text of the stdout run of the Copy output `button`."
  [^js button]
  (copy-text! button (apply str (map #(.-textContent ^js %) (stdout-run (.-parentElement button))))))

(def stdout-chunk-size
  "How many characters a stdout block holds before its output continues in a new block."
  10000)

(defn- chunk-end
  "Returns where to cut `text` for a chunk of at most `size` characters: after the last newline in it, and for
   a new block only when that newline is in the chunk's latter half, else at `size`. Text for the `room` of the
   last block is cut after its last newline, or not taken at all."
  [text size room?]
  (let [newline (if (pos? size) (.lastIndexOf text "\n" (dec size)) -1)]
    (cond
      room? (inc newline)
      (> newline (quot size 2)) (inc newline)
      ;; Not between the two halves of a surrogate pair
    (<= 0xD800 (.charCodeAt text (dec size)) 0xDBFF) (dec size)
    :else size)))

(defn stdout-chunks
  "Returns `text` split for stdout blocks: first the lines that fit the `room` left in the last block, maybe
   none, then parts of up to `stdout-chunk-size` characters, each cut after a newline when there is one in
   its latter half."
  [text room]
  (loop [text text
         size room
         chunks []]
    (if (<= (count text) size)
      (conj chunks text)
      (let [cut (chunk-end text size (empty? chunks))]
        (recur (subs text cut) stdout-chunk-size (conj chunks (subs text 0 cut)))))))

(defn stdout-element
  "Returns the hiccup of a stdout block of `category`, with its Copy output button before `text`. A block that
   `continues?` the stdout block before it is marked so."
  ([text category]
   (stdout-element text category false))
  ([text category continues?]
   [:pre (cond-> {:class ["output-stdout"] :data-output-element-type category}
           continues? (assoc :data-continues "true"))
    [copy-button/button {:class ["output-stdout-copy"]
                         :copy/label "Copy output"
                         :copy/actions [[:output/ax.copy-stdout :event/target]]}]
    text]))

(defn append-stdout
  "Appends stdout `output` of `category` to `dom-element`: to its last block, while that is stdout of the same
   category with room left, and in new blocks of up to `stdout-chunk-size` characters after it."
  [^js dom-element output category]
  (let [category (or category "evalOut")
        ^js last-block (.-lastElementChild dom-element)
        run-block (when (= category (some-> last-block (.getAttribute "data-output-element-type"))) last-block)
        room (if run-block (max 0 (- stdout-chunk-size (count (.-textContent run-block)))) 0)
        [fitting & more] (stdout-chunks (strip-ansi output) room)]
    (when (seq fitting)
      (let [^js last-text (.-lastChild run-block)]
        (if (= 3 (.-nodeType last-text))
          (.appendData last-text fitting)
          (.appendChild run-block (js/document.createTextNode fitting)))))
    (let [element (reduce (fn [previous chunk]
                            (insert-hiccup! dom-element "beforeend" (stdout-element chunk category (some? previous))))
                          run-block
                          more)]
      (.. dom-element (dispatchEvent (output-appended-event (or element last-block)))))))

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

(defn clojure-code-element
  "Returns the hiccup of a code block with `clojure-code` and its copy button, colored with `ranges`,
   `[from to color styles]`, and marked with `marks`, `[from to class]`, when it has them."
  ([clojure-code]
   (clojure-code-element clojure-code nil nil))
  ([clojure-code ranges marks]
   [:pre {:class ["output-code-block"]}
    (into [:code (cond-> {:class ["output-code" "clojure-code"]}
                   ranges (assoc :data-highlighted (if (seq ranges) "grammar" "plain")))]
          (if (seq ranges)
            (code-highlight/spans clojure-code ranges marks)
            [clojure-code]))
    [copy-button/button {:class ["output-code-copy"]
                         :copy/label "Copy"
                         :copy/actions [[:output/ax.copy-code :event/target]]}]]))

(defonce ^:private !last-code-id (atom 0))

(defn- code-id!
  "Returns the id of the `code` element, giving it one first when it has none."
  [^js code]
  (or (.. code -dataset -codeId)
      (set! (.. code -dataset -codeId) (str (swap! !last-code-id inc)))))

(defn- request-highlighting!
  "Asks the extension for the highlighting of the `codes` elements."
  [codes]
  (when (seq codes)
    (post-to-host! {:command "output-highlight"
                    :output/codes (mapv (fn [^js code] [(code-id! code) (.-textContent code)]) codes)})))

(defonce ^{:private true :doc "The namespace and session of the output, from its latest namespace header."}
  !context (atom nil))

(defn- stamp-context!
  "Gives the code in `element` that has no namespace the output's current namespace and session."
  [^js element]
  (let [{:keys [ns session-key]} @!context]
    (doseq [^js code (array-seq (.querySelectorAll element "code.clojure-code"))
            :when (and ns (not (.. code -dataset -ns)))]
      (set! (.. code -dataset -ns) ns)
      (some->> session-key (set! (.. code -dataset -sessionKey))))))

(defonce ^{:private true
           :doc "The grammar's colors of each code element colored by the grammar, `{:ranges :marks}` by its id."}
  !grammar-colors (atom {}))

(defonce ^{:private true :doc "The key of the latest request for the semantic tokens of each code element, by its id."}
  !semantic-keys (atom {}))

(defonce ^:private !last-semantic-key (atom 0))

(defonce ^{:private true :doc "The requests for semantic tokens waiting for a pause, and the pause's timer."}
  !semantic-requests (atom {:codes [] :timer nil}))

(def ^:private max-semantic-requests
  "How many requests for semantic tokens wait for a pause, at most, before they are posted."
  100)

(defn- post-semantic-requests!
  []
  (let [[{:keys [codes timer]}] (reset-vals! !semantic-requests {:codes [] :timer nil})]
    (some-> timer js/clearTimeout)
    (when (seq codes)
      (post-to-host! {:command "output-semantic-tokens"
                      :output/codes codes}))))

(defn- semantic-request!
  "Returns the request for the semantic tokens of the `code` element colored with the grammar's `colors`,
   `[key text ns session-key]`, its key new, so that an answer to an earlier request is left out."
  [^js code colors]
  (let [id (code-id! code)
        request-key (str id "@" (swap! !last-semantic-key inc))]
    (swap! !grammar-colors assoc id colors)
    (swap! !semantic-keys assoc id request-key)
    [request-key (.-textContent code) (.. code -dataset -ns) (.. code -dataset -sessionKey)]))

(defn- request-semantic-tokens-later!
  "Asks the extension for the semantic tokens of the `codes` elements colored with the grammar's `colors`,
   with those of other code, a pause after the last request, or at once when many wait. Code without a
   namespace gets none."
  [codes colors]
  (let [requests (mapv #(semantic-request! % colors) (filter #(.. ^js % -dataset -ns) codes))]
    (when (seq requests)
      (some-> (:timer @!semantic-requests) js/clearTimeout)
      (if (>= (count (:codes (swap! !semantic-requests update :codes into requests))) max-semantic-requests)
        (post-semantic-requests!)
        (swap! !semantic-requests assoc :timer (js/setTimeout post-semantic-requests! 100))))))

(defn- code-elements
  "Returns the code elements with the `ids`, by their id."
  [ids]
  (if (< (count ids) 20)
    (into {} (keep (fn [id]
                     (some->> (js/document.querySelector (str "code[data-code-id=\"" id "\"]"))
                              (vector id))))
          ids)
    (into {} (map (fn [^js code] [(.. code -dataset -codeId) code]))
          (array-seq (js/document.querySelectorAll "code[data-code-id]")))))

(defn- set-spans!
  "Sets the children of the `code` element to its text colored with `ranges` and marked with `marks`."
  [^js code ranges marks]
  (printed-code-editor/drawn! code {:ranges ranges :marks marks})
  (code-highlight/set-spans! code (.-textContent code) ranges marks))

(defn- color-with-grammar!
  "Colors the `code` element with the grammar's `colors`, `{:ranges :marks}`, and asks for its semantic
   tokens."
  [^js code {:keys [ranges marks] :as colors}]
  (set-spans! code ranges marks)
  (set! (.. code -dataset -highlighted) "grammar")
  (request-semantic-tokens-later! [code] colors))

(defonce ^{:private true
           :doc "The colors of the latest code colored, `{:ranges :marks :looks}` by its text, namespace and
                 session, with `:looks` the semantic tokens layered over the grammar's `:ranges`, so code drawn
                 again, like an error's details, is colored at once."}
  !remembered (atom {:colors {} :texts []}))

(defn- remembered-key
  "Returns what the colors of the `code` element are remembered by: its text, namespace and session."
  [^js code]
  [(.-textContent code) (.. code -dataset -ns) (.. code -dataset -sessionKey)])

(def ^:private remembered-texts 100)

(defn- remember!
  "Remembers the `colors` of the code with the `remembered-key` `text`, forgetting the colors remembered longest
   ago when there are more than `remembered-texts`."
  [text colors]
  (swap! !remembered
         (fn [{:keys [texts] :as remembered}]
           (let [texts (if (contains? (:colors remembered) text) texts (conj texts text))
                 forgotten (drop-last remembered-texts texts)]
             (-> remembered
                 (assoc :texts (vec (take-last remembered-texts texts)))
                 (update :colors #(apply dissoc (assoc % text colors) forgotten)))))))

(defn- color-remembered!
  "Colors the `code` element with the `colors` remembered for its text, asking for semantic tokens only when
   the colors have none."
  [^js code {:keys [ranges marks looks] :as colors}]
  (cond
    (empty? ranges) (set! (.. code -dataset -highlighted) "plain")
    looks (do (set-spans! code looks marks)
              (swap! !grammar-colors assoc (code-id! code) (dissoc colors :looks))
              (set! (.. code -dataset -highlighted) "grammar"))
    :else (color-with-grammar! code colors)))

(defn- request-missing-highlighting!
  "Gives the code in `element` the output's namespace, and colors the code that has no highlighting with the
   colors remembered for its text, or asks the extension for them."
  [^js element]
  (stamp-context! element)
  (let [missing (remove #(.. ^js % -dataset -highlighted)
                        (array-seq (.querySelectorAll element "code.clojure-code")))
        remembered (:colors @!remembered)
        {known true unknown false} (group-by #(contains? remembered (remembered-key %)) missing)]
    (doseq [^js code known]
      (color-remembered! code (get remembered (remembered-key code))))
    (request-highlighting! unknown)))

(defn set-code-highlighting!
  "Colors the code elements of `codes`, `[id ranges brackets]` each, with their ranges and brackets, marking
   each as colored by the grammar, as plain when it has no ranges, being too long, or as uncolored when the
   extension can't color it, without the theme or the grammar."
  [codes]
  (let [elements (code-elements (map first codes))]
    (doseq [[id ranges brackets] codes
            :let [^js code (get elements id)
                  colors {:ranges ranges :marks (code-brackets/mark-ranges brackets)}]
            :when code]
      (cond
        (seq ranges) (do (remember! (remembered-key code) colors)
                         (color-with-grammar! code colors))
        ranges (do (remember! (remembered-key code) {:ranges []})
                   (set! (.. code -dataset -highlighted) "plain"))
        :else (do (set! (.-textContent code) (.-textContent code))
                  (set! (.. code -dataset -highlighted) "uncolored"))))))

(defn set-semantic-tokens!
  "Lays the semantic `ranges` of `codes`, `[request-key ranges]` each, over the grammar's ranges of their code
   elements, for the latest request of each."
  [codes]
  (let [current (filter (fn [[request-key]]
                          (= request-key (get @!semantic-keys (first (str/split request-key #"@")))))
                        codes)
        elements (code-elements (map #(first (str/split (first %) #"@")) current))]
    (doseq [[request-key ranges] current
            :let [id (first (str/split request-key #"@"))
                  ^js code (get elements id)
                  {grammar :ranges :keys [marks] :as colors} (get @!grammar-colors id)]
            :when (and code grammar (seq ranges))]
      (let [looks (highlight/layered grammar ranges)]
        (set-spans! code looks marks)
        (remember! (remembered-key code) (assoc colors :looks looks))))))

(defn- rehighlight-code!
  "Asks the extension for the highlighting of the code in `dom-element` that the grammar colored, or that the
   extension couldn't color, as when the color theme changed."
  [^js dom-element]
  (reset! !remembered {:colors {} :texts []})
  (reset! !semantic-keys {})
  (request-highlighting! (concat (array-seq (.querySelectorAll dom-element "code.clojure-code[data-highlighted=\"grammar\"]"))
                                 (array-seq (.querySelectorAll dom-element "code.clojure-code[data-highlighted=\"uncolored\"]")))))

(defn- copy-code!
  "Copies the code of the code block of the Copy `button`."
  [^js button]
  (copy-text! button (.. button -parentElement (querySelector "code") -textContent)))

(defn evaluated-code-element
  "Returns the hiccup of evaluated `code`, under its label, colored with `ranges` and marked with `marks` when
   it has them. Code of the evaluation `evaluation-id` has a spinner after its label until the evaluation ends."
  [code ranges marks evaluation-id]
  [:div {:class ["evaluated-code-container"] :data-evaluation-id evaluation-id}
   [:span {:class ["border-text"]}
    "Evaluated code"
    (when evaluation-id
      (spinner/element ["evaluated-code-spinner"]))]
   (clojure-code-element code ranges marks)])

(defn- append-code!
  "Appends the code of `hiccup-of`, called with its grammar's `colors`, to `dom-element`, and asks for the
   highlighting of the code that has none, and for the semantic tokens of the code that has."
  [^js dom-element hiccup-of {:keys [ranges] :as colors}]
  (some-> ranges code-highlight/add-classes!)
  (let [element (insert-hiccup! dom-element "beforeend" (hiccup-of colors))]
    (when (seq ranges)
      (doseq [code (array-seq (.querySelectorAll element "code.clojure-code"))]
        (printed-code-editor/drawn! code (select-keys colors [:ranges :marks]))))
    (request-missing-highlighting! element)
    (when (seq ranges)
      (request-semantic-tokens-later! (array-seq (.querySelectorAll element "code.clojure-code")) colors))
    (.. dom-element (dispatchEvent (output-appended-event element)))))

(defn append-evaluated-code
  "Appends evaluated `code` of the evaluation `evaluation-id` to `dom-element`, colored with `ranges` and its
   `brackets` when it has them."
  [^js dom-element {:keys [code ranges brackets evaluation-id]}]
  (append-code! dom-element
                (fn [{:keys [ranges marks]}] (evaluated-code-element code ranges marks evaluation-id))
                {:ranges ranges :marks (code-brackets/mark-ranges brackets)}))

(defn append-eval-result
  "Appends the printed `result` to `dom-element`, colored with `ranges` and its `brackets` when it has them."
  [^js dom-element result ranges brackets]
  (append-code! dom-element
                (fn [{:keys [ranges marks]}] (clojure-code-element result ranges marks))
                {:ranges ranges :marks (code-brackets/mark-ranges brackets)}))

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

(defn- image-display
  []
  (some-> js/document .-body (.getAttribute "data-image-display")))

(defn- remove-thumbnail!
  "Removes `thumb` and, when that empties the `.output-images` row, removes the row too."
  [^js thumb]
  (when-let [parent (.-parentNode thumb)]
    (.removeChild parent thumb)
    (when (zero? (.-childElementCount parent))
      (when-let [grandparent (.-parentNode parent)]
        (.removeChild grandparent parent)))))

(defn- output-image
  "Returns the thumbnail image that is the target of `event`, if it is one."
  [^js event]
  (let [^js target (.-target event)]
    (when (some-> target (.matches "img.output-image"))
      target)))

(defn on-image-load
  "Shows the thumbnail of a loaded image, which makes the output grow."
  [^js event]
  (when-let [img (output-image event)]
    (set! (.. img -parentNode -dataset -pending) "false")
    (.. event -currentTarget (dispatchEvent (output-appended-event img)))))

(defn on-image-error
  "Removes the thumbnail of an image that can't be shown."
  [^js event]
  (some-> (output-image event) .-parentNode remove-thumbnail!))

(defn- raw-display?
  []
  (= "raw" (image-display)))

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

(defn- image-src
  "Returns the `src` the thumbnail of `image` has when it's added. A local image gets its `src` from
   its lookup, and a remote image only while `display` includes remote URLs."
  [{:image/keys [data-url kind src]} display]
  (cond
    data-url data-url
    (= :local kind) nil
    (= :remote kind) (when (= "images-including-remote-urls" display) src)
    :else src))

(defn image-element
  "Returns the hiccup of the thumbnail of `image`, the full image scaled down by CSS, with its Copy
   image button. A data URL, local or remote image is `data-pending` until it loads. `display` is the
   image display."
  [{:image/keys [data-url kind src] :as image} display]
  (let [label (images/label image)
        kind-name (some-> kind name)]
    [:div {:class ["output-image-thumbnail"]
           :data-image-kind kind-name
           :data-pending (when (or data-url kind) "true")}
     [:img {:class ["output-image"]
            :alt label
            :title label
            :data-image-kind kind-name
            :data-local-src (when (= :local kind) src)
            :data-remote-src (when (= :remote kind) src)
            :src (image-src image display)}]
     [copy-button/button {:class ["output-image-copy"]
                          :copy/label (str "Copy " label)
                          :copy/tooltip "Copy image"
                          :copy/actions [[:output/ax.copy-image (-> (select-keys image [:image/mime :image/kind :image/src])
                                                                    (assoc :copy/button :event/target))]]}]]))

(defn- copy-image-of-button!
  "Copies the image of the Copy image `button`. A data URL image's data is its `src`."
  [{:copy/keys [^js button] :as image}]
  (let [^js img (.querySelector (.-parentNode button) "img")]
    (copy-image! button img (cond-> image
                              (str/starts-with? (.-src img) "data:") (assoc :image/data-url (.-src img))))))

(defn- segment-elements
  "Returns the hiccup of a result's text segment as Clojure code, with the thumbnails of the images on its
   lines below it."
  [{:keys [text images]} display]
  (list (when (seq text)
          (clojure-code-element text))
        (when (seq images)
          [:div {:class ["output-images"]}
           (for [image images]
             (image-element image display))])))

(defn images-form-element
  "Returns the hiccup of the images form of a result, from its text `segments`."
  [segments display]
  [:div {:data-image-form "images"}
   (for [segment segments]
     (segment-elements segment display))])

(defn- look-up-local-images!
  "Looks up the local images in `element`, or queues them while the display is raw."
  [^js element session-key]
  (doseq [^js img (.querySelectorAll element "img[data-local-src]")
          :let [thumbnail (.-parentNode img)
                src (.getAttribute img "data-local-src")]]
    (if (raw-display?)
      (queue-pending-local! img thumbnail src session-key)
      (resolve-local-image! img thumbnail src session-key))))

(defn- add-raw-form!
  "Adds the raw form, the result as printed, to the result `entry`."
  [^js entry raw]
  (request-missing-highlighting! (insert-hiccup! entry "beforeend" [:div {:data-image-form "raw"} (clojure-code-element raw)])))

(defn append-result-with-images
  "Appends a result with images. Its images form is added now. Its raw form is added after it when the
   display is raw, or later, when the display turns raw."
  [^js dom-element {:keys [text raw images meta]}]
  (let [session-key (or (:meta/repl-session-key meta) (:repl-session-key meta))
        entry (insert-hiccup! dom-element "beforeend"
                              [:div {:class ["output-with-images"] :data-output-element-type "images"}
                               (images-form-element (images/segments-with-images text images) (image-display))])]
    (request-missing-highlighting! entry)
    (look-up-local-images! entry session-key)
    (if (raw-display?)
      (add-raw-form! entry raw)
      (swap! !lazy-raw-entries conj [entry raw]))
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
  "Appends the namespace header of `meta-data`, the namespace and session of the output after it."
  [^js dom-element meta-data]
  (reset! !context {:ns (or (:meta/ns meta-data) (:ns meta-data))
                    :session-key (or (:meta/repl-session-key meta-data) (:repl-session-key meta-data))})
  (let [ns-info-el (insert-hiccup! dom-element "beforeend" (ns-info-element meta-data))]
    (.. dom-element (dispatchEvent (output-appended-event ns-info-el)))))

(defn clear-output-dom
  [^js output-dom-element]
  (reset! !lazy-raw-entries [])
  (reset! !grammar-colors {})
  (reset! !remembered {:colors {} :texts []})
  (reset! !semantic-keys {})
  (reset! !pending-local-images [])
  (clear-local-image-lookups!)
  (set! (.-innerHTML output-dom-element) ""))

(defonce ^:private !frame-name-sheet (atom nil))

(defn- frame-name-sheet
  []
  (or @!frame-name-sheet
      (let [sheet (js/CSSStyleSheet.)]
        (set! (.-adoptedStyleSheets js/document) (.concat (.-adoptedStyleSheets js/document) #js [sheet]))
        (reset! !frame-name-sheet sheet))))

(defn set-frame-name-color!
  "Gives the stack frames' function names the hex `color`, the theme's color for function names, or the text's
   color for any other color."
  [color]
  (.replaceSync ^js (frame-name-sheet)
                (if (code-highlight/color-class color)
                  (str ":root { --calva-frame-name-color: " color "; }")
                  "")))

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
                             (.getAttribute img "data-remote-src")
                             (str/blank? (str (.-src img))))
                    (set! (.-src img) (.getAttribute img "data-remote-src"))))))))

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
      (doseq [[entry raw] entries]
        (add-raw-form! entry raw))))
  (apply-remote-src! image-display)
  (apply-local-src! image-display))

(defn set-accessibility-support!
  "Shows screen readers the output in `output-element` near the visible part with `accessibility-support?`,
   and otherwise hides all of it from them and puts `accessibility-note` in the `note` element."
  [^js output-element ^js note {:keys [accessibility-support? accessibility-note]}]
  (.. js/document -body (setAttribute "data-accessibility-support" (if accessibility-support? "on" "off")))
  (if accessibility-support?
    (do (viewport-observer/start! output-element)
        (.removeAttribute output-element "aria-hidden"))
    (do (viewport-observer/stop! output-element)
        (.setAttribute output-element "aria-hidden" "true")))
  (when note
    (set! (.-textContent note) (if accessibility-support? "" accessibility-note))))

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
  [^js dom-element {:error/keys [id] :as error}]
  (let [hiccup (error-element/element error)
        ^js existing (.querySelector dom-element (str "[data-error-id=\"" id "\"]"))]
    (if existing
      (let [control (focused-control existing)
            ^js new-element (insert-hiccup! existing "afterend" hiccup)]
        (.remove existing)
        (request-missing-highlighting! new-element)
        (some-> (.querySelector new-element (str "[data-control=\"" control "\"]")) .focus))
      (let [new-element (insert-hiccup! dom-element "beforeend" hiccup)]
        (request-missing-highlighting! new-element)
        (.. dom-element (dispatchEvent (output-appended-event new-element)))))))

(defn- copy-error-text!
  "Writes `text` to the clipboard and marks the error's copy button as copied. Runs in the click's
   dispatch: the clipboard write needs the user activation."
  [^js dom-element {:error/keys [id] :copy/keys [text]}]
  (copy-text! (.querySelector dom-element (str "[data-error-id=\"" id "\"] [data-control=\"copy\"]"))
              text))

(defn- render-keybindings-note!
  "Draws the greeting's note about the user's `custom` keybindings in place of the note it has."
  [custom]
  (when-let [^js element (js/document.getElementById keybindings-note/element-id)]
    (set! (.-innerHTML element) "")
    (some->> (keybindings-note/element custom) (insert-hiccup! element "beforeend"))))

(declare dispatch!)

(def output-cap
  "The most characters of output an Output view page keeps, `:accessibility-support-off` and `-on`."
  {:accessibility-support-off 1000000
   :accessibility-support-on 100000})

(defn- output-cap-for
  [accessibility-support?]
  (if accessibility-support?
    (:accessibility-support-on output-cap)
    (:accessibility-support-off output-cap)))

(defn- current-output-cap
  []
  (output-cap-for (= "on" (.. js/document -body (getAttribute "data-accessibility-support")))))

(defn kept-block-count
  "Returns how many of the newest output blocks fit `cap` characters by their text `lengths`, newest first,
   and at least one."
  [lengths cap]
  (max 1 (count (take-while #(<= % cap) (reductions + lengths)))))

(defn- error-ids
  "Returns the ids of the errors in the output `blocks`."
  [blocks]
  (keep (fn [^js block]
          (some-> (if (.hasAttribute block "data-error-id") block (.querySelector block "[data-error-id]"))
                  (.getAttribute "data-error-id")))
        blocks))

(defn- in-removed?
  "True when `node` is one of the `removed` blocks, a JS Set, or inside one."
  [^js removed ^js node]
  (loop [^js n node]
    (cond
      (nil? n) false
      (.has removed n) true
      :else (recur (.-parentNode n)))))

(defn- forget-blocks!
  "Drops what the page keeps for the removed output `blocks`: colors and semantic tokens of their code, raw
   forms and image lookups of their images."
  [blocks]
  (let [removed? (partial in-removed? (js/Set. (into-array blocks)))
        code-ids (set (for [^js block blocks
                            ^js code (array-seq (.querySelectorAll block "code"))
                            :let [id (.. code -dataset -codeId)]
                            :when id]
                        id))
        removed-request? (fn [[request-key]] (contains? code-ids (first (str/split request-key #"@"))))]
    (swap! !grammar-colors #(apply dissoc % code-ids))
    (swap! !semantic-keys #(apply dissoc % code-ids))
    (swap! !semantic-requests update :codes #(into [] (remove removed-request?) %))
    (swap! !lazy-raw-entries #(into [] (remove (comp removed? first)) %))
    (swap! !pending-local-images #(into [] (remove (comp removed? :img)) %))
    (swap! !local-image-lookups update-vals (fn [lookup] (update lookup :waiters #(into [] (remove (comp removed? first)) %))))))

(defn trim-output!
  "Removes the oldest output blocks of `output-element` while its text is over `cap` characters, keeping at
   least the newest block, and drops what the page keeps for them."
  [^js output-element cap]
  (let [blocks (vec (array-seq (.-children output-element)))
        kept (kept-block-count (map #(count (.-textContent ^js %)) (rseq blocks)) cap)
        removed (subvec blocks 0 (- (count blocks) kept))]
    (when (seq removed)
      (when (some #(.contains ^js % js/document.activeElement) removed)
        (some-> (js/document.getElementById "output-scroller") (.focus #js {:preventScroll true})))
      (printed-code-editor/unmount-in! dispatch! removed)
      (run! #(.remove ^js %) removed)
      (some-> ^js (first (subvec blocks (count removed))) (.removeAttribute "data-continues"))
      (forget-blocks! removed)
      (when-let [ids (seq (error-ids removed))]
        (dispatch! [:output/ax.errors-removed {:error/ids (vec ids)}]))
      (auto-scroll/follow!))))

(def ^:private throttled-trim-output!
  (throttle-fn #(trim-output! % (current-output-cap)) 250))

(defn exec-effect!
  [^js output-dom-element [fx-type & args :as effect]]
  (case fx-type
    :fx/append-ns-info (append-ns-info output-dom-element (first args))
    :fx/append-result (apply append-eval-result output-dom-element args)
    :fx/append-evaluated-code (append-evaluated-code output-dom-element (first args))
    :fx/end-evaluation (spinner/end-evaluation! output-dom-element (first args))
    :fx/set-bracket-styles (some-> (first args) code-brackets/css code-brackets/set-css!)
    :fx/set-code-highlighting (set-code-highlighting! (first args))
    :fx/set-semantic-tokens (set-semantic-tokens! (first args))
    :fx/rehighlight-code (rehighlight-code! output-dom-element)
    :fx/copy-code (copy-code! (first args))
    :fx/append-stdout (append-stdout output-dom-element (first args) (second args))
    :fx/append-result-with-images (append-result-with-images output-dom-element (first args))
    :fx/render-error (render-error! output-dom-element (first args))
    :fx/post-to-host (post-to-host! (first args))
    :fx/copy-error-text (copy-error-text! output-dom-element (first args))
    :fx/copy-stdout (copy-stdout! (first args))
    :fx/copy-text (let [{:copy/keys [button text]} (first args)] (copy-text! button text))
    :fx/copy-image (copy-image-of-button! (first args))
    :fx/clear-dom (clear-output-dom output-dom-element)
    :fx/set-frame-name-color (set-frame-name-color! (first args))
    :fx/set-word-wrap (set-word-wrap! (first args))
    :fx/set-image-display (set-image-display! (first args))
    :fx/set-accessibility-support (set-accessibility-support! output-dom-element
                                                              (js/document.getElementById "output-hidden-note")
                                                              (first args))
    :fx/trim-output (trim-output! output-dom-element (output-cap-for (first args)))
    :fx/scroll-to-end (auto-scroll/reveal-end!)
    :fx/set-font-scale (set-font-scale! (first args))
    :fx/render-keybindings-note (render-keybindings-note! (first args))
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
         "output-highlighting"  (dispatch! [:msg/output-highlighting message-data])
         "output-semantic-tokens" (dispatch! [:msg/output-semantic-tokens message-data])
         "set-word-wrap"        (dispatch! [:msg/set-word-wrap message-data])
         "set-base-font-scale"  (dispatch! [:msg/set-base-font-scale message-data])
         "adjust-font-size"     (dispatch! [:msg/adjust-font-size message-data])
         "reset-font-size"      (dispatch! [:msg/reset-font-size message-data])
         "set-image-display"    (dispatch! [:msg/set-image-display message-data])
         "set-accessibility-support" (dispatch! [:msg/set-accessibility-support message-data])
         "scroll-to-end"        (dispatch! [:msg/scroll-to-end])
         "keybindings-note"     (dispatch! [:keybindings-note/ax.set-note message-data])
         "local-image-resolved" (deliver-host-request! (:id message-data) message-data)
         "local-image-missing"  (deliver-host-request! (:id message-data) message-data)
         "image-bytes"          (deliver-host-request! (:id message-data) message-data)
         "image-bytes-missing"  (deliver-host-request! (:id message-data) message-data)
         "repl-input-enabled"   (dispatch! [:repl-input/ax.set-enabled (:repl-input/enabled? message-data)])
         "repl-input-edit"      (dispatch! [:repl-input/ax.edit message-data])
         "repl-input-command-keys" (dispatch! [:repl-input/ax.set-command-keys (:repl-input/command-keys message-data)])
         "repl-input-brackets"  (dispatch! [:repl-input/ax.set-brackets message-data])
         "repl-input-highlighting" (dispatch! [:repl-input/ax.set-highlighting message-data])
         "repl-input-semantic-tokens" (dispatch! [:repl-input/ax.set-semantic-tokens message-data])
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
         "repl-input-mode-chosen" (dispatch! [:repl-input/ax.mode-chosen])
         "printed-code-selections" (dispatch! [:printed-code/ax.select message-data])
         "printed-code-brackets" (dispatch! [:printed-code/ax.set-brackets message-data])
         "printed-code-command-keys" (dispatch! [:printed-code/ax.set-command-keys (:repl-input/command-keys message-data)])
         "printed-code-focus"   (dispatch! [:printed-code/ax.focus])
         ("show-result" "show-evaluated-code" "show-stdout" "evaluation-ended")
         (dispatch! [:msg/output message-data])
         "show-error"           (dispatch! [:msg/error message-data])
         "show-error-causes"    (dispatch! [:msg/error-causes message-data])
         (js/console.error "No handler for message" (str command-name)))))))

(defn handle-output-appended
  [^js event]
  (throttled-trim-output! (.-currentTarget event))
  (throttled-scroll-to-bottom))

(defn- ends-selection?
  "True when the mouse click `event` ends a text selection in `element`."
  [^js event ^js element]
  (let [selection (js/window.getSelection)]
    (and (pos? (.-detail event))
         (not (.-isCollapsed selection))
         (.containsNode selection element true))))

(defn on-output-click
  "Hides the page's tooltip and dispatches the actions in the `data-action` of the clicked element, or of
   the nearest element around it that has one. `:event/target` in them stands for that element. An
   element with `data-plain-click` ignores a click that ends a text selection in it."
  [^js event]
  (when-let [^js element (some-> ^js (.-target event) (.closest "[data-action]"))]
    (tooltip/hide!)
    (when-not (and (some? (.getAttribute element "data-plain-click"))
                   (ends-selection? event element))
      (run! dispatch! (walk/postwalk-replace {:event/target element}
                                             (reader/read-string (.getAttribute element "data-action")))))))

(defn add-event-listeners
  [^js output-dom-element]
  (.. js/window (addEventListener "message" handle-message))
  (.. output-dom-element (addEventListener "output-appended" handle-output-appended))
  (.. output-dom-element (addEventListener "click" #(on-output-click %)))
  (some-> (js/document.getElementById keybindings-note/element-id) (.addEventListener "click" #(on-output-click %)))
  (.. output-dom-element (addEventListener "load" #(on-image-load %) true))
  (.. output-dom-element (addEventListener "error" #(on-image-error %) true)))

(defn ^:export main []
  (add-event-listeners output-dom-element)
  (auto-scroll/listen!)
  (when (= "on" (.. js/document -body (getAttribute "data-accessibility-support")))
    (viewport-observer/start! output-dom-element)))
