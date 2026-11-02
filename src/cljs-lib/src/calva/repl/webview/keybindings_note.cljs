(ns calva.repl.webview.keybindings-note
  "The note at the end of the greeting about the user's custom keybindings for the commands the Output views
   handle, folded to one line, with a button that reads the keybindings again."
  (:require
   [calva.repl.webview.copy-button :as copy-button]))

(def element-id
  "The id of the greeting's element that holds the note."
  "keybindings-note")

(defn- summary-text
  [n]
  (if (zero? n)
    "All custom keybindings reach the Output views"
    (str n " of your custom keybindings " (if (= 1 n) "doesn't" "don't") " reach the Output views")))

(defn- keybinding-item
  [{:keys [key command calva-when]}]
  [:li
   [:span [:code key] " " [:code command]]
   [copy-button/button {:copy/label "Copy Calva's when clause"
                        :copy/actions [[:keybindings-note/ax.copy-when {:copy/button :event/target
                                                                        :copy/text calva-when}]]}]])

(defn- missing-list
  [missing]
  (list [:p "Their " [:code "when"] " clauses leave the Output views out. Copy the " [:code "when"]
         " clause of Calva's own keybinding for a command, and use it in yours."]
        [:ul (map keybinding-item missing)]))

(defn element
  "Returns the hiccup of the note about the user's `custom` keybindings, as
   `command-keys/output-views-custom-keybindings` returns them, or nil when there are none."
  [custom]
  (when (seq custom)
    (let [missing (remove :reaches-output-views? custom)]
      [:details {:class ["keybindings-note"]}
       [:summary (summary-text (count missing))]
       (when (seq missing)
         (missing-list missing))
       [:button {:type "button"
                 :class ["keybindings-note-read-again"]
                 :data-action (pr-str [[:keybindings-note/ax.read-again]])}
        "Read keybindings again"]])))
