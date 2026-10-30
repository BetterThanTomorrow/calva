(ns calva.repl.webview.error-element
  "The hiccup of an error entry in an Output view: the error text with a control to unfold its causes
   and their frames. Its controls' actions are in their `data-action` attributes."
  (:require
   ["highlight.js/lib/core" :as hljs]
   [calva.repl.webview.stacktrace :as stacktrace]
   [calva.repl.webview.tooltip :as tooltip]
   [clojure.string :as string]))

(def ^:private chevron-path
  "M10.072 8.024L5.715 3.667l.618-.62L11 7.716v.618L6.333 13l-.618-.619 4.357-4.357z")

(defn- pre-text
  "Returns `text` for a `pre` it starts. HTML parsing drops a line break that starts a `pre`, so a
   leading line break is doubled."
  [text]
  (cond->> text
    (some-> text (string/starts-with? "\n")) (str "\n")))

(defn- actions
  [& actions]
  (pr-str (vec actions)))

(def ^:private chevron
  [:svg {:class ["output-error-chevron"] :viewBox "0 0 16 16" :aria-hidden "true"}
   [:path {:d chevron-path}]])

(defn- toggle-row
  "A row that unfolds or folds what follows it when clicked, with a chevron button for the keyboard.
   `control` names the button, so focus can return to it after a redraw. A click that ends a text
   selection in the row does nothing, so its text stays selectable."
  [{:keys [class-name control label expanded? action]} & children]
  (into [:div {:class [class-name] :data-action (actions action) :data-plain-click true}
         [:button {:type "button"
                   :class ["output-error-chevron-button"]
                   :aria-label label
                   :aria-expanded (str (boolean expanded?))
                   :data-control control}
          chevron]]
        children))

(defn- link-button
  [attributes title & children]
  (into [:button (merge {:type "button"} attributes (tooltip/attributes title))]
        children))

(defn- frames-text
  [n]
  (str n (if (= 1 n) " frame" " frames")))

(defn- clojure-detail
  "A detail that is Clojure code, with the theme's token colors."
  [code]
  [:pre {:class ["output-error-detail"]}
   [:code {:class ["output-error-code"]
           :innerHTML (.-value (.highlight hljs code #js {:language "clojure" :ignoreIllegals true}))}]])

(defn- frame-action
  [{:error/keys [session-key]} {:frame/keys [file-url java?] :as parts}]
  (cond
    file-url [:error/ax.open-frame parts]
    java? [:error/ax.open-java-frame (assoc parts :error/session-key session-key)]))

(defn- frame-element
  [error frame]
  (let [{:frame/keys [location qualifier name java?] :as parts} (stacktrace/frame-parts frame)
        action (frame-action error parts)
        location-element [:span {:class ["output-error-frame-location"]} location]]
    [:li (cond-> {:class (cond-> ["output-error-frame"] action (conj "output-error-frame-openable"))}
           action (assoc :data-action (actions action) :data-plain-click true))
     (if action
       (link-button {:class ["output-error-frame-link"]}
                    (if java? (str "Look up the source of " qualifier) (str "Open " location))
                    location-element)
       location-element)
     [:span {:class ["output-error-frame-qualifier"]} (str qualifier "/")]
     [:span {:class ["hljs-name"]} name]]))

(defn- location-element
  [{:location/keys [label file-url line column]}]
  (if file-url
    (link-button {:class ["output-error-location-link"]
                  :data-action (actions [:error/ax.open-frame {:frame/file-url file-url :frame/line line :frame/column column}])
                  :data-plain-click true}
                 (str "Open " label)
                 label)
    [:div {:class ["output-error-location"]} label]))

(defn- spec-problems
  [{:keys [problems] :as spec}]
  (when (seq problems)
    (clojure-detail (stacktrace/spec-problems-text spec))))

(defn- pressable-button
  [{:keys [control label title pressed? action]}]
  [:button (merge {:type "button"
                   :class ["output-error-filter"]
                   :aria-pressed (str (boolean pressed?))
                   :data-control control
                   :data-action (actions action)}
                  (tooltip/attributes title))
   label])

(defn- frame-filter-switch
  [{:error/keys [id frame-filter]}]
  [:span {:class ["output-error-switch"] :role "group" :aria-label "Frames"}
   (for [{:choice/keys [label] choice :choice/frame-filter} stacktrace/frame-filter-choices]
     (pressable-button {:control (str "choice-" (name choice))
                        :label label
                        :title (str "Show " label)
                        :pressed? (= choice frame-filter)
                        :action [:error/ax.set-frame-filter {:error/id id :error/frame-filter choice}]}))])

(defn- hide-flags-row
  [{:error/keys [id hidden-flags]}]
  [:div {:class ["output-error-filter-row"] :role "group" :aria-label "Hide frames"}
   [:span {:class ["output-error-filter-label"]} "Hide:"]
   (for [{:filter/keys [label flag]} stacktrace/frame-filters]
     (pressable-button {:control (str "flag-" flag)
                        :label label
                        :title (str "Hide " label " frames")
                        :pressed? (contains? hidden-flags flag)
                        :action [:error/ax.toggle-flag {:error/id id :frame/flag flag}]}))])

(defn- filter-bar
  [{:error/keys [causes frame-filter] :as error}]
  (let [hidden (reduce + (map #(stacktrace/hidden-count error (:stacktrace %)) causes))]
    [:div {:class ["output-error-filters"]}
     [:div {:class ["output-error-filter-row"]}
      (frame-filter-switch error)
      [:span {:class ["output-error-hidden-count"]} (str (frames-text hidden) " hidden")]]
     (when (= :filtered frame-filter)
       (hide-flags-row error))]))

(defn- cause-element
  [{:error/keys [id unfolded-causes] :as error} index {:keys [triage spec data stacktrace] :as cause}]
  (let [frames-unfolded? (contains? unfolded-causes index)
        frames (stacktrace/visible-frames error stacktrace)]
    [:div {:class ["output-error-cause"]}
     (toggle-row {:class-name "output-error-cause-toggle"
                  :control (str "cause-" index)
                  :label (str "Frames of " (:class cause))
                  :expanded? frames-unfolded?
                  :action [:error/ax.toggle-cause {:error/id id :cause/index index}]}
                 [:span {:class ["output-error-cause-heading"]} (stacktrace/cause-heading cause)]
                 [:span {:class ["output-error-frame-count"]} (frames-text (count frames))])
     (when triage
       [:pre {:class ["output-error-detail"]} (pre-text triage)])
     (when-not triage
       (spec-problems spec))
     (when data
       (clojure-detail data))
     (when frames-unfolded?
       [:ol {:class ["output-error-frames"]}
        (map #(frame-element error %) frames)])]))

(defn- error-heading
  [{:error/keys [id text causes unfolded?]}]
  (let [text-element [:pre {:class ["output-error-text"]} (pre-text text)]]
    (if (stacktrace/has-frames? causes)
      (toggle-row {:class-name "output-error-toggle"
                   :control "error"
                   :label "Stacktrace"
                   :expanded? unfolded?
                   :action [:error/ax.toggle id]}
                  text-element)
      text-element)))

(defn- copy-button
  "The button that copies the error with the frames its filter shows."
  [{:error/keys [id]}]
  [:button (merge {:type "button"
                   :class ["output-copy-button" "output-error-copy"]
                   :aria-label "Copy error"
                   :data-copy-label "Copy error"
                   :data-control "copy"
                   :data-action (actions [:error/ax.copy {:error/id id}])}
                  (tooltip/attributes "Copy error"))])

(defn element
  "Returns the hiccup of `error`. An error whose causes have no frames, or haven't arrived, shows its
   text only."
  [{:error/keys [id category causes unfolded?] :as error}]
  [:div {:class ["output-error"]
         :data-output-element-type "error"
         :data-error-id id
         :data-error-category (or category "evalErr")}
   (error-heading error)
   (when (stacktrace/has-frames? causes)
     (copy-button error))
   (when (and unfolded? (stacktrace/has-frames? causes))
     [:div {:class ["output-error-causes"]}
      (some->> (stacktrace/compile-location causes) location-element)
      (filter-bar error)
      (map-indexed #(cause-element error %1 %2) causes)])])
