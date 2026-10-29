(ns calva.repl.webview.error-element
  "Draws an error entry in an Output view: the error text with a control to unfold its causes and
   their frames."
  (:require
   ["highlight.js/lib/core" :as hljs]
   [calva.repl.webview.stacktrace :as stacktrace]
   [calva.repl.webview.tooltip :as tooltip]))

(def ^:private svg-namespace "http://www.w3.org/2000/svg")

(def ^:private chevron-path
  "M10.072 8.024L5.715 3.667l.618-.62L11 7.716v.618L6.333 13l-.618-.619 4.357-4.357z")

(defn- create-element
  [tag class-name & children]
  (let [element (js/document.createElement tag)]
    (when class-name
      (.. element -classList (add class-name)))
    (doseq [child children
            :when child]
      (.. element (appendChild (if (string? child)
                                 (js/document.createTextNode child)
                                 child))))
    element))

(defn- chevron
  []
  (let [svg (js/document.createElementNS svg-namespace "svg")
        path (js/document.createElementNS svg-namespace "path")]
    (doseq [[k v] {"class" "output-error-chevron" "viewBox" "0 0 16 16" "aria-hidden" "true"}]
      (.. svg (setAttribute k v)))
    (.. path (setAttribute "d" chevron-path))
    (.. svg (appendChild path))
    svg))

(defn- ends-selection?
  "True when the mouse click `event` ends a text selection in `element`."
  [^js event ^js element]
  (let [selection (js/window.getSelection)]
    (and (pos? (.-detail event))
         (not (.-isCollapsed selection))
         (.containsNode selection element true))))

(defn- on-plain-click!
  "Calls `f` for clicks in `element`, from the mouse or the keyboard, that don't end a text
   selection in it, and returns `element`. Its text stays selectable."
  [^js element f]
  (.. element (addEventListener "click" #(when-not (ends-selection? % element) (f))))
  element)

(defn- toggle-row
  "A row that unfolds or folds what follows it when clicked, with a chevron button for the
   keyboard. `control` names the button, so focus can return to it after a redraw."
  [{:keys [class-name control label expanded? on-toggle]} & children]
  (let [button (create-element "button" "output-error-chevron-button" (chevron))]
    (set! (.-type button) "button")
    (.. button (setAttribute "aria-label" label))
    (.. button (setAttribute "aria-expanded" (str (boolean expanded?))))
    (.. button (setAttribute "data-control" control))
    (on-plain-click! (apply create-element "div" class-name button children) on-toggle)))

(defn- link-button
  [class-name title & children]
  (let [link (apply create-element "button" class-name children)]
    (set! (.-type link) "button")
    (tooltip/attach! link title)))

(defn- frames-text
  [n]
  (str n (if (= 1 n) " frame" " frames")))

(defn- clojure-detail
  "A detail that is Clojure code, with the theme's token colors."
  [code]
  (let [code-element (create-element "code" "output-error-code")]
    (set! (.-innerHTML code-element)
          (.-value (.highlight hljs code #js {:language "clojure" :ignoreIllegals true})))
    (create-element "pre" "output-error-detail" code-element)))

(defn- frame-opener
  [dispatch {:error/keys [session-key]} {:frame/keys [file-url java?] :as parts}]
  (cond
    file-url #(dispatch [:error/ax.open-frame parts])
    java? #(dispatch [:error/ax.open-java-frame (assoc parts :error/session-key session-key)])))

(defn- frame-element
  [dispatch error frame]
  (let [{:frame/keys [location qualifier name java?] :as parts} (stacktrace/frame-parts frame)
        open (frame-opener dispatch error parts)
        location-element (create-element "span" "output-error-frame-location" location)
        element (create-element "li" "output-error-frame"
                                (if open
                                  (link-button "output-error-frame-link"
                                               (if java? (str "Look up the source of " qualifier) (str "Open " location))
                                               location-element)
                                  location-element)
                                (create-element "span" "output-error-frame-qualifier" (str qualifier "/"))
                                (create-element "span" "hljs-name" name))]
    (when open
      (.. element -classList (add "output-error-frame-openable"))
      (on-plain-click! element open))
    element))

(defn- location-element
  [dispatch {:location/keys [label file-url line column]}]
  (if file-url
    (on-plain-click! (link-button "output-error-location-link" (str "Open " label) label)
                     #(dispatch [:error/ax.open-frame {:frame/file-url file-url :frame/line line :frame/column column}]))
    (create-element "div" "output-error-location" label)))

(defn- spec-problems
  [{:keys [problems] :as spec}]
  (when (seq problems)
    (clojure-detail (stacktrace/spec-problems-text spec))))

(defn- pressable-button
  [{:keys [control label title pressed? on-click]}]
  (let [button (create-element "button" "output-error-filter" label)]
    (set! (.-type button) "button")
    (tooltip/attach! button title)
    (.. button (setAttribute "aria-pressed" (str (boolean pressed?))))
    (.. button (setAttribute "data-control" control))
    (.. button (addEventListener "click" on-click))
    button))

(defn- frame-filter-switch
  [dispatch {:error/keys [id frame-filter]}]
  (let [switch (apply create-element "span" "output-error-switch"
                      (for [{:choice/keys [label] choice :choice/frame-filter} stacktrace/frame-filter-choices]
                        (pressable-button {:control (str "choice-" (name choice))
                                           :label label
                                           :title (str "Show " label)
                                           :pressed? (= choice frame-filter)
                                           :on-click #(dispatch [:error/ax.set-frame-filter {:error/id id :error/frame-filter choice}])})))]
    (.. switch (setAttribute "role" "group"))
    (.. switch (setAttribute "aria-label" "Frames"))
    switch))

(defn- hide-flags-row
  [dispatch {:error/keys [id hidden-flags]}]
  (let [row (apply create-element "div" "output-error-filter-row"
                   (create-element "span" "output-error-filter-label" "Hide:")
                   (for [{:filter/keys [label flag]} stacktrace/frame-filters]
                     (pressable-button {:control (str "flag-" flag)
                                        :label label
                                        :title (str "Hide " label " frames")
                                        :pressed? (contains? hidden-flags flag)
                                        :on-click #(dispatch [:error/ax.toggle-flag {:error/id id :frame/flag flag}])})))]
    (.. row (setAttribute "role" "group"))
    (.. row (setAttribute "aria-label" "Hide frames"))
    row))

(defn- filter-bar
  [dispatch {:error/keys [causes frame-filter] :as error}]
  (let [hidden (reduce + (map #(stacktrace/hidden-count error (:stacktrace %)) causes))]
    (create-element "div" "output-error-filters"
                    (create-element "div" "output-error-filter-row"
                                    (frame-filter-switch dispatch error)
                                    (create-element "span" "output-error-hidden-count" (str (frames-text hidden) " hidden")))
                    (when (= :filtered frame-filter)
                      (hide-flags-row dispatch error)))))

(defn- cause-element
  [dispatch {:error/keys [id unfolded-causes] :as error} index {:keys [triage spec data stacktrace] :as cause}]
  (let [frames-unfolded? (contains? unfolded-causes index)
        frames (stacktrace/visible-frames error stacktrace)]
    (create-element "div" "output-error-cause"
                    (toggle-row {:class-name "output-error-cause-toggle"
                                 :control (str "cause-" index)
                                 :label (str "Frames of " (:class cause))
                                 :expanded? frames-unfolded?
                                 :on-toggle #(dispatch [:error/ax.toggle-cause {:error/id id :cause/index index}])}
                                (create-element "span" "output-error-cause-heading" (stacktrace/cause-heading cause))
                                (create-element "span" "output-error-frame-count" (frames-text (count frames))))
                    (when triage
                      (create-element "pre" "output-error-detail" triage))
                    (when-not triage
                      (spec-problems spec))
                    (when data
                      (clojure-detail data))
                    (when frames-unfolded?
                      (apply create-element "ol" "output-error-frames" (map #(frame-element dispatch error %) frames))))))

(defn- error-heading
  [dispatch {:error/keys [id text causes unfolded?]}]
  (let [text-element (create-element "pre" "output-error-text" text)]
    (if (stacktrace/has-frames? causes)
      (toggle-row {:class-name "output-error-toggle"
                   :control "error"
                   :label "Stacktrace"
                   :expanded? unfolded?
                   :on-toggle #(dispatch [:error/ax.toggle id])}
                  text-element)
      text-element)))

(defn- copy-button
  "The button that copies the error with the frames its filter shows."
  [dispatch {:error/keys [id]}]
  (let [button (create-element "button" "output-copy-button")]
    (.. button -classList (add "output-error-copy"))
    (set! (.-type button) "button")
    (tooltip/attach! button "Copy error")
    (doseq [[k v] {"aria-label" "Copy error"
                   "data-copy-label" "Copy error"
                   "data-control" "copy"}]
      (.. button (setAttribute k v)))
    (.. button (addEventListener "click" #(dispatch [:error/ax.copy {:error/id id}])))
    button))

(defn create
  "Returns the element for `error`. Its controls dispatch actions with `dispatch`. An error whose
   causes have no frames, or haven't arrived, shows its text only."
  [{:error/keys [id category causes unfolded?] :as error} dispatch]
  (let [element (create-element "div" "output-error"
                                (error-heading dispatch error)
                                (when (stacktrace/has-frames? causes)
                                  (copy-button dispatch error))
                                (when (and unfolded? (stacktrace/has-frames? causes))
                                  (apply create-element "div" "output-error-causes"
                                         (some->> (stacktrace/compile-location causes) (location-element dispatch))
                                         (filter-bar dispatch error)
                                         (map-indexed #(cause-element dispatch error %1 %2) causes))))]
    (.. element (setAttribute "data-output-element-type" "error"))
    (.. element (setAttribute "data-error-id" id))
    (.. element (setAttribute "data-error-category" (or category "evalErr")))
    element))
