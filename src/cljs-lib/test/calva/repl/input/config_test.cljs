(ns calva.repl.input.config-test
  (:require
   [calva.repl.input.config :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(def storage
  {"profileAssociations" {"workspaces" {"file:///projects/pairing" "-2f458877"
                                        "file:///projects/agents" "builtin/agents"
                                        "file:///projects/default" "__default__profile__"}}
   "userDataProfiles" [{"location" "-2f458877" "name" "Pairing"}
                       {"location" "builtin/agents" "name" "Agents"
                        "useDefaultFlags" {"settings" true "keybindings" true}}]})

(deftest keybindings-path-test
  (testing "a profile with its own keybindings has them in its folder"
    (is (= "/User/profiles/-2f458877/keybindings.json"
           (sut/keybindings-path "/User" storage "file:///projects/pairing"))))
  (testing "the default profile's keybindings"
    (is (= "/User/keybindings.json"
           (sut/keybindings-path "/User" storage "file:///projects/agents"))
        "for a profile that uses the default profile's keybindings")
    (is (= "/User/keybindings.json"
           (sut/keybindings-path "/User" storage "file:///projects/default"))
        "for the default profile")
    (is (= "/User/keybindings.json"
           (sut/keybindings-path "/User" storage "file:///projects/other"))
        "for a workspace with no profile")
    (is (= "/User/keybindings.json"
           (sut/keybindings-path "/User" nil ""))
        "when storage.json can't be read")))
