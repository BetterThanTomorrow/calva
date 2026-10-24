(ns calva.repl.input.focus
  "Which REPL Input has focus, which decides `calva:replInputFocused`.")

(defn focused-after
  "Returns the id of the REPL Input that has focus after `event`, or nil."
  [focused [event-type id]]
  (case event-type
    :focus id
    (:blur :dispose :hide :unmount) (when (not= id focused) focused)
    :text-editor-focus nil))
