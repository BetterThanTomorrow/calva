(ns calva.docs.toc-test
  (:require [calva.docs.toc :as toc]
            [clojure.test :refer [deftest is testing]]))

(defn- heading [level id]
  {:heading/level level :heading/id id :heading/text id})

(defn- entry [level id & children]
  (assoc (heading level id) :heading/children (vec children)))

(deftest page-toc
  (testing "the headings under the page's H1 nest by level"
    (is (= [(entry 2 "a" (entry 3 "a1") (entry 3 "a2" (entry 4 "a2x")))
            (entry 2 "b")]
           (toc/page-toc [(heading 1 "title") (heading 2 "a") (heading 3 "a1") (heading 3 "a2")
                          (heading 4 "a2x") (heading 2 "b")]))))
  (testing "a skipped level nests under the nearest heading above it"
    (is (= [(entry 2 "a" (entry 4 "deep") (entry 3 "mid"))]
           (toc/page-toc [(heading 2 "a") (heading 4 "deep") (heading 3 "mid")]))))
  (testing "without an H1 first, every top heading is in the toc"
    (is (= [(entry 2 "a") (entry 2 "b")]
           (toc/page-toc [(heading 2 "a") (heading 2 "b")]))))
  (testing "only the first H1's headings are in the toc"
    (is (= [(entry 2 "a")]
           (toc/page-toc [(heading 1 "one") (heading 2 "a") (heading 1 "two") (heading 2 "b")]))))
  (testing "a page without headings has no toc"
    (is (= [] (toc/page-toc [])))))
