(ns calva.repl.webview.html-test
  (:require
   [calva.repl.webview.html :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(deftest render-test
  (testing "writes double quotes in text and attribute values as double quotes"
    (is (= "<pre data-action=\"[[:copy {:text &quot;a&quot;}]]\">{:c &quot;four&quot;} &apos;x</pre>"
           (sut/render [:pre {:data-action "[[:copy {:text \"a\"}]]"} "{:c \"four\"} 'x"]))))
  (testing "keeps text that looks like an entity as text"
    (is (= "<pre>&amp;#39;</pre>" (sut/render [:pre "&#39;"]))))
  (testing "writes innerHTML as it is"
    (is (= "<style>a > b { content: \"\"; }</style>"
           (sut/render [:style {:innerHTML "a > b { content: \"\"; }"}])))))

(deftest document-test
  (is (= "<!DOCTYPE html><html lang=\"en\"></html>" (sut/document [:html {:lang "en"}]))))
