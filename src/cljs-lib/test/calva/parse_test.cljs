(ns calva.parse-test
  (:require [cljs.test :refer [testing is deftest]]
            [calva.parse :refer [parse-edn parse-forms parse-clj-edn]]))

(deftest parse-edn-test
  (testing "Should parse form preceded by #= as is"
    (is (= (parse-edn "#=(+ 1 2)") "#=(+ 1 2)")))
  (testing "Should parse map with keyword key and vector value"
    (is (= (parse-edn "{:foo [1 2]}") {:foo [1 2]})))
  (testing "Should parse map with namespaced keyword key and vector value"
    (is (= (parse-edn "{:foo/bar [1 2]}") {:foo/bar [1 2]})))
  (testing "Should return first form if input is multiple top level forms"
    (is (= (parse-edn ":a {:foo ['bar] :bar 'foo}") :a))))

(deftest parse-forms-test
  (testing "Should parse keyword, map, vector, symbol, and should add ' before symbols"
    (is (= (parse-forms ":a {:foo [bar] :bar foo}")
           [:a {:foo ['bar] :bar 'foo}])))
  (testing "Should parse quote symbol into `quote` and should parse forms preceded by #= as nil"
    (is (= (parse-forms ":a {:foo ['bar] :bar 'foo} #=(+ 1 2)")
           [:a {:foo ['(quote bar)] :bar '(quote foo)} nil])))
  (testing "Should parse forms preceded by #= as nil (and not evaluate them)"
    (is (= (parse-forms "{:a #=(1 + 2)}")
           [{:a nil}]))))

(deftest parse-clj-edn-test
  (testing "Should parse nil as nil"
    (is (= (parse-clj-edn nil) nil)))
  (testing "Should parse map with keyword key and vector"
    (is (= (parse-clj-edn "{:foo [1 2]}") {:foo [1 2]})))
  (testing "Should parse map with namespaced keyword key and vector"
    (is (= (parse-clj-edn "{:foo/bar [1 2]}") {:foo/bar [1 2]})))
  (testing "Should return first form if input is multiple top level forms"
    (is (= :a (parse-clj-edn ":a {:foo ['bar] :bar 'foo}"))))
  (testing "Should parse edn regexp as js regexp"
    (is (= js/RegExp (type (parse-clj-edn "#\"^foo.*bar$\"")))))
  (testing "Should return string representation of regexp as string"
    (is (= "/^foo.*bar$/" (str (parse-clj-edn "#\"^foo.*bar$\""))))))