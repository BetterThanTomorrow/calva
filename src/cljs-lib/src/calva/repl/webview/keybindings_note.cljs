(ns calva.repl.webview.keybindings-note
  "The note at the end of the greeting about the user's keybindings whose when clauses leave the Output views
   out, folded to one line, with a button that reads the keybindings again.")

(def element-id
  "The id of the greeting's element that holds the note."
  "keybindings-note")

(defn- summary-text
  [n]
  (str n " of your keybindings " (if (= 1 n) "doesn't" "don't") " reach the Output views"))

(defn- keybinding-item
  [{:keys [key command calva-when] when-clause :when}]
  [:li
   [:code key] " " [:code command]
   [:dl
    [:dt "Your " [:code "when"]] [:dd [:code when-clause]]
    [:dt "Calva's " [:code "when"]] [:dd [:code calva-when]]]])

(defn element
  "Returns the hiccup of the note about the `missing` keybindings, as
   `command-keys/keybindings-missing-output-views` returns them, or nil when there are none."
  [missing]
  (when (seq missing)
    [:details {:class ["keybindings-note"]}
     [:summary (summary-text (count missing))]
     [:p "Their " [:code "when"] " clauses leave the Output views out. Calva's own keybinding of each command has a "
      [:code "when"] " clause that also holds in the Output views."]
     [:ul (map keybinding-item missing)]
     [:button {:type "button" :data-action (pr-str [[:keybindings-note/ax.read-again]])}
      "Read keybindings again"]]))
