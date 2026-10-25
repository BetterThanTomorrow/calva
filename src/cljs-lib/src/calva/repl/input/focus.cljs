(ns calva.repl.input.focus
  "Which REPL Input has focus, which decides `calva:replInputFocused`, and which is the last focused
   place, which decides `calva:replInputLastFocused`.")

(defn focused-after
  "Returns the id of the REPL Input that has focus after `event`, or nil."
  [focused [event-type id]]
  (case event-type
    :focus id
    (:blur :dispose :hide :deactivate :unmount) (when (not= id focused) focused)
    (:text-editor-focus :terminal-focus) nil))

(defn last-focused-after
  "Returns the id of the REPL Input that is the last focused place after `event`, or nil. A REPL Input
   stays the last focused place when it loses the focus, until a text editor or a terminal gets it, or
   its view goes away."
  [last-focused [event-type id]]
  (case event-type
    :focus id
    :blur last-focused
    (:dispose :hide :deactivate :unmount) (when (not= id last-focused) last-focused)
    (:text-editor-focus :terminal-focus) nil))
