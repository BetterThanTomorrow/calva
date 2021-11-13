(ns calva.fmt.editor
  (:require [calva.fmt.util :as util]))


(defn replacement-edits-for-diffing-lines
  "Returns a list of replacement edits to apply to `old-text` to get `new-text`.
   Edits will be in the form `[:replace [range] text]`,
   where `range` is in the form `[[start-line start-char] [end-line end-char]]`.
   NB: The two versions need to have the same amount of lines."
  [old-text new-text]
  (let [old-lines (util/split-into-lines old-text)
        new-lines (util/split-into-lines new-text)]
    (->> (map vector (range) old-lines new-lines)
         (remove (fn [[line o n]] (= o n)))
         (mapv (fn [[line o n]]
                 {:edit "replace"
                  :start {:line line
                          :character 0}
                  :end {:line line
                        :character (count o)}
                  :text n})))))


(comment
  (replacement-edits-for-diffing-lines "foo\nfooo\nbar\nbar"
                                       "foo\nbar\nbaz\nbar")
  (->> (map vector
            [:foo :foo :foo]
            [:foo :bar :foo]
            (range))
       (remove (fn [[o n i]]
                 (= o n))))
  (filter some?
          (map (fn [o n line] (when-not (= o n) [o n line]))
               [:foo :foo :foo]
               [:foo :bar :foo]
               (range))))