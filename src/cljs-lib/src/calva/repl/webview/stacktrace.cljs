(ns calva.repl.webview.stacktrace
  "Errors with the causes cider-nrepl's stacktrace analyzer reports, as the Output views show them."
  (:require [clojure.string :as str]))

(defn- nil-for-empty
  "Returns `m` with nil for bencode's empty list."
  [m]
  (update-vals m #(if (and (sequential? %) (empty? %)) nil %)))

(defn- frame-data
  [frame]
  (-> (nil-for-empty frame)
      ;; Older cider-nrepl versions send an empty string for a frame without a file
      (update :file-url not-empty)
      (update :flags set)))

(defn cause-data
  "Returns `cause`, a keywordized cause message from cider-nrepl, with nil for bencode's empty
   list, and `:flags` as a set."
  [cause]
  (-> (nil-for-empty (dissoc cause :id :session))
      (update :stacktrace #(mapv frame-data %))))

(defn has-frames?
  "True when any of the `causes` has frames."
  [causes]
  (boolean (some (comp seq :stacktrace) causes)))

(def frame-filters
  "The filters that hide frames with a flag, as an Output view names them."
  [{:filter/label "Clojure" :filter/flag "clj"}
   {:filter/label "Java" :filter/flag "java"}
   {:filter/label "REPL" :filter/flag "repl"}
   {:filter/label "Tooling" :filter/flag "tooling"}
   {:filter/label "Duplicates" :filter/flag "dup"}])

(def frame-filter-choices
  [{:choice/label "All frames" :choice/frame-filter :all}
   {:choice/label "Filtered" :choice/frame-filter :filtered}
   {:choice/label "Project only" :choice/frame-filter :project}])

(def ^:private compile-phases
  #{"read-source" "macro-syntax-check" "macroexpansion" "compile-syntax-check" "compilation"})

(defn compile-location
  "Returns where a compile error happened, from its outermost cause, or nil for other errors."
  [[{:keys [phase path file file-url line column]}]]
  (when (contains? compile-phases phase)
    {:location/label (str (or path file) ":" line ":" column)
     :location/file-url file-url
     :location/line line
     :location/column column}))

(defn with-causes
  "Returns `error` with `causes`. The root cause shows its frames, unless it is a compile error,
   where all frames are tooling."
  [error causes]
  (assoc error
         :error/causes causes
         :error/unfolded-causes (if (compile-location causes) #{} #{(dec (count causes))})))

(defn error-entry
  "Returns the entry an Output view keeps for an error with `causes`, which can come later. It
   starts folded unless `unfolded?`, and tooling and duplicate frames are hidden."
  [{:keys [id meta] :error/keys [text category causes unfolded?]}]
  (with-causes {:error/id id
                :error/text text
                :error/category category
                :error/session-key (:meta/repl-session-key meta)
                :error/unfolded? (boolean unfolded?)
                :error/frame-filter :filtered
                :error/hidden-flags #{"tooling" "dup"}}
    causes))

(defn- toggle-member
  [s x]
  (if (contains? s x) (disj s x) (conj s x)))

(defn toggle-unfolded
  [error]
  (update error :error/unfolded? not))

(defn toggle-cause
  "Shows or hides the frames of the cause at `index`."
  [error index]
  (update error :error/unfolded-causes toggle-member index))

(defn toggle-flag
  "Hides or shows the frames with `flag`."
  [error flag]
  (update error :error/hidden-flags toggle-member flag))

(defn visible-frames
  "Returns the `frames` that the error's frame filter shows."
  [{:error/keys [frame-filter hidden-flags]} frames]
  (case frame-filter
    :all frames
    :project (filterv #(contains? (:flags %) "project") frames)
    (filterv #(not-any? hidden-flags (:flags %)) frames)))

(defn hidden-count
  [error frames]
  (- (count frames) (count (visible-frames error frames))))

(defn frame-parts
  "Returns what an Output view shows for `frame`: file and line, namespace and function or class
   and method, the `file-url` to open, if any, and whether it is a Java frame."
  [{:keys [type file line ns fn class method file-url]}]
  {:frame/location (str file ":" line)
   :frame/qualifier (or ns class)
   :frame/name (if ns fn method)
   :frame/file-url file-url
   :frame/line line
   :frame/java? (= "java" type)})

(defn cause-heading
  [{:keys [class message]}]
  (str class ": " (or message "No message")))

(defn spec-problems-text
  "Returns one line per problem in a cause's `spec`."
  [{:keys [problems]}]
  (apply str (for [{:keys [val predicate]} problems]
               (str val " - failed: " predicate "\n"))))

(defn- frame-line
  [frame]
  (let [{:frame/keys [location qualifier name]} (frame-parts frame)]
    (str "  " qualifier "/" name " (" location ")")))

(defn- cause-lines
  [{:error/keys [unfolded-causes] :as error} index {:keys [triage spec data stacktrace] :as cause}]
  (concat [(str (when (pos? index) "Caused by: ") (cause-heading cause))]
          (->> [(or triage (spec-problems-text spec)) data]
               (remove str/blank?)
               (map str/trimr))
          (when (contains? unfolded-causes index)
            (map frame-line (visible-frames error stacktrace)))))

(defn shown-text
  "Returns `error` as text, the way its unfolded stacktrace shows it: the error text, then every
   cause with its details, and the frames of unfolded causes that the frame filter shows."
  [{:error/keys [text causes] :as error}]
  (str/join "\n" (concat [text]
                         (some-> (compile-location causes) :location/label vector)
                         (mapcat #(cause-lines error %1 %2) (range) causes))))

(defn whole-text
  "Returns `error` as text with its whole stacktrace: every cause with all its frames."
  [{:error/keys [causes] :as error}]
  (shown-text (assoc error
                     :error/frame-filter :all
                     :error/unfolded-causes (set (range (count causes))))))
