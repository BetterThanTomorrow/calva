(ns calva.docs.markdown-test
  (:require [calva.docs.markdown :as markdown]
            [clojure.test :refer [deftest is testing]]))

(deftest heading-ids
  (testing "ids are lower-case words joined by dashes, without punctuation"
    (is (= ["the-calva-extension-api" "replcurrentsessionkey" "what-youll-learn" "cafe"]
           (markdown/heading-ids ["The Calva Extension API" "repl.currentSessionKey()"
                                  "What you'll learn" "Café"]))))
  (testing "repeated and empty ids get numbered suffixes"
    (is (= ["notes" "notes_1" "notes_2" "_1"]
           (markdown/heading-ids ["Notes" "Notes" "Notes" "!!!"])))))

(deftest page-sections
  (testing "the text before the first heading, then each heading's text up to the next heading"
    (is (= [{:section/html "<p>Intro</p>"}
            {:section/id "title-x" :section/level 1 :section/title-html "Title <code>x</code>"
             :section/html "<p>Body <em>b</em></p>"}
            {:section/id "sub" :section/level 2 :section/title-html "Sub"
             :section/html "<ul>\n<li>a</li>\n</ul> <p>Note</p> <p>In a note</p>"}]
           (:page/sections
            (markdown/render-blocks [{:block/type :markdown
                                      :block/markdown "Intro\n\n# Title `x`\n\nBody *b*\n\n## Sub\n\n- a"}
                                     {:block/type :admonition :block/title "Note" :block/markdown "In a note"}]
                                    identity))))))

(deftest front-matter
  (testing "values are trimmed and unquoted, and section keys get the section namespace"
    (is (= {:page/title "Tao" :page/description "Learn about Calva" :search/boost "7"}
           (markdown/front-matter "title: \"Tao\"\ndescription: Learn about Calva \nsearch:\n  boost: 7")))))
