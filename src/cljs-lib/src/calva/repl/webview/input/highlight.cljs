(ns calva.repl.webview.input.highlight
  "Highlighting for the REPL Input, from the highlighter the Output views use."
  (:require
   [clojure.string :as str]
   ["highlight.js/lib/core" :as hljs]))

(defn scope-class
  "Returns the CSS classes highlight.js gives `scope`, e.g. `title.function` → `hljs-title function_`."
  [scope]
  (let [[head & more] (str/split scope #"\.")]
    (str/join " " (cons (str "hljs-" head)
                        (map-indexed (fn [i piece] (str piece (apply str (repeat (inc i) "_"))))
                                     more)))))

(defn highlight-ranges
  "Returns `[from to class]` for each scoped node highlight.js finds when it reads `text` as Clojure."
  [text]
  (let [^js result (.highlight hljs text #js {:language "clojure" :ignoreIllegals true})
        root (.. result -_emitter -rootNode)
        walk (fn walk [ranges ^js node offset]
               (if (string? node)
                 [ranges (+ offset (count node))]
                 (let [[ranges end] (reduce (fn [[ranges o] child] (walk ranges child o))
                                            [ranges offset]
                                            (.-children node))
                       scope (.-scope node)]
                   [(cond-> ranges
                      (and scope (< offset end)) (conj [offset end (scope-class scope)]))
                    end])))]
    (first (walk [] root 0))))
