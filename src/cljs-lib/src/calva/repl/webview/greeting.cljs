(ns calva.repl.webview.greeting
  (:require
   [calva.util :as util]
   [clojure.string :as string]))

(def jack-in-keys ["nrepl" "cider-nrepl" "cider/piggieback"])

(def view-copy
  {:output-view {:heading "This is the Calva REPL Output view."
                 :destination-key "output-view"
                 :command-title "Calva: Show/Open the REPL output view"}
   :output-sidebar {:heading "This is the Calva REPL Output sidebar."
                    :destination-key "output-sidebar"
                    :command-title "Calva: Show/Open the REPL output sidebar"}})

(defn destinations-json
  "Returns a pretty-printed JSON string for destinations."
  [destinations]
  (if (string? destinations)
    destinations
    (js/JSON.stringify destinations nil 2)))

(defn destinations-config
  "Returns the current output-destination configuration block."
  [destinations]
  (list [:p "The current output destination configuration is:"]
        [:pre (destinations-json destinations)]
        [:p "See " [:a {:href "https://calva.io/output"} "https://calva.io/output"] " for details."]))

(defn merge-configured-versions
  "Merges inspected jack-in version overrides, later sources winning."
  [^js inspected]
  (reduce (fn [acc src]
            (if src
              (merge acc (js->clj src))
              acc))
          {}
          [(.-globalValue inspected)
           (.-globalLanguageValue inspected)
           (.-workspaceValue inspected)
           (.-workspaceLanguageValue inspected)
           (.-workspaceFolderValue inspected)
           (.-workspaceFolderLanguageValue inspected)]))

(defn effective-versions
  "Returns key -> {:version :source} for jack-in deps."
  [defaults configured]
  (reduce (fn [acc key]
            (let [configured-value (get configured key)]
              (if (and (string? configured-value)
                       (pos? (count (string/trim configured-value))))
                (assoc acc key {:version configured-value
                                :source :configured})
                (assoc acc key {:version (or (get defaults key) "")
                                :source :default}))))
          {}
          jack-in-keys))

(defn effective-version-text
  "Formats one effective jack-in version line."
  [{:keys [version source]}]
  (str version
       " ("
       (if (= source :configured)
         "configured in settings"
         "Calva defaults")
       ")"))

(defn latest-version-text
  "Formats one Clojars latest-version line."
  [entry]
  (let [stable (or (get entry "stable") (get entry :stable))
        prerelease (or (get entry "prerelease") (get entry :prerelease))]
    (if (or stable prerelease)
      (str (or stable "unknown")
           (when prerelease
             (str " (prerelease: " prerelease ")")))
      "unknown")))

(defn greeting
  "Returns the first-open greeting for a view."
  [{:keys [view-kind logo-href]}]
  (let [{:keys [heading destination-key command-title]} (get view-copy view-kind)]
    [:div {:class "output-greeting"}
     [:p heading [:span {:class "output-greeting-read-only"} " It is read-only."]
      " Evaluation results, stdout/stderr, and other REPL messages appear here, if "
      [:code destination-key] " is configured as an "
      [:a {:href "https://calva.io/output"} "output destination"] "."]
     [:p "To reveal this view, use the command " [:strong command-title] "."]
     [:p [:a {:href "https://calva.io"}
          [:img {:class "calva-logo" :src (str logo-href) :width "120" :alt "Calva"}]]]
     [:p "Please consider " [:a {:href "https://calva.io/sponsors"} "sponsoring Calva"] " ♥️"]]))

(defn current-output-destinations
  "Reads the current calva.outputDestinations setting."
  []
  (.. ^js @util/vscode -workspace (getConfiguration "calva") (get "outputDestinations")))

(defn for-view
  "Returns the greeting for view-kind using live VS Code state."
  [view-kind logo-href]
  (let [^js vsc @util/vscode
        ^js ctx @util/vscode-context
        ^js calva-cfg (.. ^js vsc -workspace (getConfiguration "calva"))
        ^js inspected (.inspect calva-cfg "jackInDependencyVersions")
        defaults (js->clj (.-defaultValue inspected))
        configured (merge-configured-versions inspected)
        stored (js->clj (.get (.-globalState ctx) "calva.jackIn.latestDependencyVersions"))
        effective (effective-versions defaults configured)
        effective-items (map (fn [key]
                               {:key key
                                :value (effective-version-text (get effective key))})
                             jack-in-keys)
        latest-items (map (fn [key]
                            {:key key
                             :value (latest-version-text (get stored key))})
                          jack-in-keys)]
    (greeting {:view-kind view-kind
               :logo-href logo-href
               :destinations (current-output-destinations)
               :effective-items effective-items
               :latest-items latest-items})))

(defn logo-webview-uri
  "Returns the webview URI for the Calva symbol+logo image."
  [{:keys [vscode/vscode]
    vscode-context :vscode/context}
   ^js webview]
  (let [extension-uri (.. ^js vscode-context -extensionUri)
        logo-path (.. ^js vscode -Uri
                      (joinPath extension-uri
                                "assets"
                                "images"
                                "calva-symbol-logo.svg"))]
    (.asWebviewUri webview logo-path)))
