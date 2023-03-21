(ns calva.html2hiccup-test
  (:require [cljs.test :refer [testing is deftest]]
            [calva.html2hiccup :as sut]))

(deftest html->hiccup
  (testing "Converts HTML to Hiccup (sanity check)"
    (is (= [[:foo#foo-id.clz1.clz2 "bar"]]
           (sut/html->hiccup "<foo id='foo-id' class='clz1 clz2'>bar</foo>"))))
  (testing "Tag is lowercased"
    (is (= [[:foo]]
           (sut/html->hiccup "<FOO></Foo>"))))
  (testing "The id gets part of the tag"
    (is (= [[:foo#foo-id]]
           (sut/html->hiccup "<foo id='foo-id'></foo>"))))
  (testing "Classes gets part of the tag"
    (is (= [[:foo.clz1.clz2]]
           (sut/html->hiccup "<foo class='clz1 clz2'></foo>"))))
  (testing "Attributes other than `class` and `id` get tucked in 'props' position"
    (is (= [[:foo#foo-id.clz1.clz2 {:bar "2"} "baz"]]
           (sut/html->hiccup "<foo id='foo-id' class='clz1 clz2' bar=2>baz</foo>"))))
  (testing "Style attributes are kept as a string"
    (is (= [[:foo#foo-id.clz1.clz2 {:style "color: red; padding 0 0 0 0"} "baz"]]
           (sut/html->hiccup "<foo id='foo-id' class='clz1 clz2' style='color: red; padding 0 0 0 0'>baz</foo>"))))
  (testing "Attributes are lowercased"
    (is (= [[:foo#foo-id.clz1.clz2]]
           (sut/html->hiccup "<foo ID='foo-id' Class='clz1 clz2'></foo>"))))
  (testing "camelCase attributes are lowercased"
    (is (= [[:foo {:onchange "bar" :maxheight "10px"}]]
           (sut/html->hiccup "<foo onChange='bar' maxHeight='10px'></foo>"))))
  (testing "Special camelCase attributes are retained"
    (is (= [[:foo {:viewBox "foo-id" :baseProfile "clz1 clz2"}]]
           (sut/html->hiccup "<foo viewBox='foo-id' baseProfile='clz1 clz2'></foo>"))))
  (testing "Elements can nest"
    (is (= [[:foo [:bar]]]
           (sut/html->hiccup "<foo><bar></bar></foo>"))))
  (testing "Multiple top level elements are supported"
    (is (= [[:foo] [:bar]]
           (sut/html->hiccup "<foo></foo><bar></bar>"))))
  (testing "Auto-closed tags are supported"
    (is (= [[:foo]]
           (sut/html->hiccup "<foo/>"))))
  (testing "html comments `<!--...-->` becomes `(comment ...)`"
    (is (= [[:foo '(comment "...")]]
           (sut/html->hiccup "<foo><!-- ... --></foo>"))))
  (testing "Removes whitespace noise"
    (is (= [[:foo]]
           (sut/html->hiccup "<foo> \n </foo>")))))

(deftest html->hiccup-w-options
  (testing "camelCase attributes are kebab-cased if :->kebab? enabled"
    (is (= [[:foo {:on-change "bar" :max-height "10px"}]]
           (sut/html->hiccup "<foo onChange='bar' maxHeight='10px'></foo>" {:->kebab? true}))))
  (testing "Special camelCase attributes are retained even when :->kebab? enabled "
    (is (= [[:foo {:viewBox "foo-id" :baseProfile "clz1 clz2"}]]
           (sut/html->hiccup "<foo viewBox='foo-id' baseProfile='clz1 clz2'></foo>" {:->kebab? true}))))
  (testing "Capitalized attributes are kebab-cased if :->kebab? enabled"
    (is (= [[:foo {:on-change "bar" :maxheight "10px"}]]
           (sut/html->hiccup "<foo OnChange='bar' Maxheight='10px'></foo>" {:->kebab? true}))))
  (testing "snake_case and SNAKE_CASE attributes are kebab-cased if :->kebab? enabled"
    (is (= [[:foo {:on-change "bar" :max-height "10px"}]]
           (sut/html->hiccup "<foo ON_CHANGE='bar' max_height='10px'></foo>" {:->kebab? true}))))
  (testing "UPPERCASE attributes are lowercased if :->kebab? enabled"
    (is (= [[:foo {:onchange "bar"}]]
           (sut/html->hiccup "<foo ONCHANGE='bar'></foo>" {:->kebab? true})))))