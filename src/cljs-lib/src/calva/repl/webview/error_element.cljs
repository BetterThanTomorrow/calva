(ns calva.repl.webview.error-element
  "Draws an error entry in an Output view: the error text with a control to unfold its causes and
   their frames."
  (:require
   [calva.repl.webview.stacktrace :as stacktrace]))

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

(defn- toggle-button
  "A button that unfolds or folds what follows it. `control` names it, so focus can return to it
   after a redraw."
  [{:keys [class-name control expanded? on-click]} & children]
  (let [button (apply create-element "button" class-name (chevron) children)]
    (set! (.-type button) "button")
    (.. button (setAttribute "aria-expanded" (str (boolean expanded?))))
    (.. button (setAttribute "data-control" control))
    (.. button (addEventListener "click" on-click))
    button))

(defn- link-button
  [class-name title action & children]
  (let [link (apply create-element "button" class-name children)]
    (set! (.-type link) "button")
    (set! (.-title link) title)
    (.. link (addEventListener "click" action))
    link))

(defn- frame-element
  [dispatch {:error/keys [session-key]} frame]
  (let [{:frame/keys [location qualifier name file-url java?] :as parts} (stacktrace/frame-parts frame)
        label [(create-element "span" "output-error-frame-location" location)
               (create-element "span" "output-error-frame-qualifier" (str qualifier "/"))
               (create-element "span" "output-error-frame-name" name)]]
    (create-element "li" "output-error-frame"
                    (cond
                      file-url
                      (apply link-button "output-error-frame-link" (str "Open " location)
                             #(dispatch [:error/ax.open-frame parts]) label)

                      java?
                      (apply link-button "output-error-frame-link" (str "Look up the source of " qualifier)
                             #(dispatch [:error/ax.open-java-frame (assoc parts :error/session-key session-key)]) label)

                      :else
                      (apply create-element "span" nil label)))))

(defn- location-element
  [dispatch {:location/keys [label file-url line column]}]
  (if file-url
    (link-button "output-error-location" (str "Open " label)
                 #(dispatch [:error/ax.open-frame {:frame/file-url file-url :frame/line line :frame/column column}])
                 label)
    (create-element "div" "output-error-location" label)))

(defn- spec-problems
  [{:keys [problems]}]
  (when (seq problems)
    (create-element "pre" "output-error-detail"
                    (apply str (for [{:keys [val predicate]} problems]
                                 (str val " - failed: " predicate "\n"))))))

(defn- pressable-button
  [{:keys [control label title pressed? disabled? on-click]}]
  (let [button (create-element "button" "output-error-filter" label)]
    (set! (.-type button) "button")
    (set! (.-title button) title)
    (set! (.-disabled button) (boolean disabled?))
    (.. button (setAttribute "aria-pressed" (str (boolean pressed?))))
    (.. button (setAttribute "data-control" control))
    (.. button (addEventListener "click" on-click))
    button))

(defn- filter-bar
  [dispatch {:error/keys [id causes frame-filter hidden-flags] :as error}]
  (let [hidden (reduce + (map #(stacktrace/hidden-count error (:stacktrace %)) causes))]
    (create-element "div" "output-error-filters"
                    (apply create-element "span" "output-error-filter-group"
                           (for [{:filter/keys [label flag]} stacktrace/frame-filters]
                             (pressable-button {:control (str "flag-" flag)
                                                :label label
                                                :title (str "Hide " label " frames")
                                                :pressed? (contains? hidden-flags flag)
                                                :disabled? (not= :filtered frame-filter)
                                                :on-click #(dispatch [:error/ax.toggle-flag {:error/id id :frame/flag flag}])})))
                    (apply create-element "span" "output-error-filter-group"
                           (for [{:choice/keys [label] choice :choice/frame-filter} stacktrace/frame-filter-choices]
                             (pressable-button {:control (str "choice-" (name choice))
                                                :label label
                                                :title (str "Show " label)
                                                :pressed? (= choice frame-filter)
                                                :on-click #(dispatch [:error/ax.set-frame-filter {:error/id id :error/frame-filter choice}])})))
                    (create-element "span" "output-error-hidden-count" (str hidden " frames hidden")))))

(defn- cause-element
  [dispatch {:error/keys [id unfolded-causes] :as error} index {:keys [triage spec data stacktrace] :as cause}]
  (let [frames-unfolded? (contains? unfolded-causes index)
        frames (stacktrace/visible-frames error stacktrace)]
    (create-element "div" "output-error-cause"
                    (toggle-button {:class-name "output-error-cause-toggle"
                                    :control (str "cause-" index)
                                    :expanded? frames-unfolded?
                                    :on-click #(dispatch [:error/ax.toggle-cause {:error/id id :cause/index index}])}
                                   (create-element "span" "output-error-cause-heading" (stacktrace/cause-heading cause))
                                   (create-element "span" "output-error-frame-count" (str (count frames) " frames")))
                    (when triage
                      (create-element "pre" "output-error-detail" triage))
                    (when-not triage
                      (spec-problems spec))
                    (when data
                      (create-element "pre" "output-error-detail" data))
                    (when frames-unfolded?
                      (apply create-element "ol" "output-error-frames" (map #(frame-element dispatch error %) frames))))))

(defn create
  "Returns the element for `error`. Its controls dispatch actions with `dispatch`."
  [{:error/keys [id text category causes unfolded?] :as error} dispatch]
  (let [element (create-element "div" "output-error"
                                (toggle-button {:class-name "output-error-toggle"
                                                :control "error"
                                                :expanded? unfolded?
                                                :on-click #(dispatch [:error/ax.toggle id])}
                                               (create-element "pre" "output-error-text" text))
                                (when unfolded?
                                  (apply create-element "div" "output-error-causes"
                                         (some->> (stacktrace/compile-location causes) (location-element dispatch))
                                         (filter-bar dispatch error)
                                         (map-indexed #(cause-element dispatch error %1 %2) causes))))]
    (.. element (setAttribute "data-output-element-type" "error"))
    (.. element (setAttribute "data-error-id" id))
    (.. element (setAttribute "data-error-category" (or category "evalErr")))
    element))
