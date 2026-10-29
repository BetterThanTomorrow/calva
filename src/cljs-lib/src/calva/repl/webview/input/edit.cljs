(ns calva.repl.webview.input.edit
  "Turns the text an extension command made into a change of the REPL Input's text.")

(defn text-change
  "The smallest change, `{:from :to :insert}`, that turns `old` into `new`, or nil when they are the same."
  [old new]
  (when (not= old new)
    (let [max-prefix (min (count old) (count new))
          prefix (or (some #(when (not= (nth old %) (nth new %)) %) (range max-prefix))
                     max-prefix)
          max-suffix (- max-prefix prefix)
          suffix (or (some #(when (not= (nth old (- (count old) % 1)) (nth new (- (count new) % 1))) %)
                           (range max-suffix))
                     max-suffix)]
      {:from prefix
       :to (- (count old) suffix)
       :insert (subs new prefix (- (count new) suffix))})))
