(ns calva.repl.input.setting
  "`calva.outputViews.replInput`, with a value per view id, and the session's toggles over it.")

(defn enabled?
  "True when the REPL Input is on for `view-id`, by the session's toggle or else by the setting."
  [setting overrides view-id]
  (true? (get overrides view-id (get setting view-id))))

(defn any-enabled?
  "True when the setting has the REPL Input on for at least one view."
  [setting]
  (boolean (some true? (vals setting))))

(defn toggle
  "Returns `overrides` with `view-id` flipped from what it has now."
  [setting overrides view-id]
  (assoc overrides view-id (not (enabled? setting overrides view-id))))
