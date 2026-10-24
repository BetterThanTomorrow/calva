(ns calva.repl.webview.input.history
  "When `up` and `down` walk the REPL Input's history instead of moving the cursor.")

(defn walk-direction
  "Returns `:back` for `up` on the first line and `:forward` for `down` on the last line, while there is
   one cursor and the completion list is closed. Else nil, and the key moves the cursor."
  [{:keys [key cursors cursor-line line-count completion-open?]}]
  (when (and (= 1 cursors) (not completion-open?))
    (case key
      :up (when (= 1 cursor-line) :back)
      :down (when (= line-count cursor-line) :forward)
      nil)))
