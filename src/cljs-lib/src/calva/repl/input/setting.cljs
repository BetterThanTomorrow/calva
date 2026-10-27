(ns calva.repl.input.setting
  "`calva.outputViews.replInput`, with a value per view id.")

(defn enabled?
  "True when the setting has the REPL Input on for `view-id`."
  [setting view-id]
  (true? (get setting view-id)))
