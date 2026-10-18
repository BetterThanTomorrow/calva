(ns calva.docs.search-test
  (:require [calva.docs.search :as search]
            [clojure.test :refer [deftest is testing]]))

(def ^:private sections
  [{:section/html ""}
   {:section/id "api" :section/level 1 :section/title-html "The API"
    :section/html "<p>See <a href=\"x/\"><strong>this</strong></a></p> <div class=\"highlight\"><pre><code><span class=\"p\">(</span>a)</code></pre></div>"}
   {:section/id "repl" :section/level 2 :section/title-html "<code>repl</code>" :section/html "<p>R</p>"}])

(deftest page-entries
  (testing "a page that opens with its H1 is found by the H1, and each section by its heading"
    (is (= [{:location "api/" :title "The API" :text "<p>See this</p> <pre><code>(a)</code></pre>" :boost 7.0}
            {:location "api/#repl" :title "<code>repl</code>" :text "<p>R</p>" :boost 7.0}]
           (search/page-entries {:page/url "api/" :page/title "API" :page/sections sections :search/boost "7"}))))
  (testing "other pages are found by their title and the text before the first heading"
    (is (= [{:location "javadocs/" :title "Javadoc" :text "<p>Intro</p>"}
            {:location "javadocs/#pre" :title "Pre" :text ""}]
           (search/page-entries {:page/url "javadocs/" :page/title "Javadoc"
                                 :page/sections [{:section/html "<p>Intro</p>"}
                                                 {:section/id "pre" :section/level 2 :section/title-html "Pre"
                                                  :section/html ""}]})))))
