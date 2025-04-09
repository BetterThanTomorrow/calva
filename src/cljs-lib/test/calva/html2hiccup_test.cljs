(ns calva.html2hiccup-test
  (:require [cljs.test :refer [testing is deftest]]
            [calva.html2hiccup :as sut]))

(deftest html->hiccup
  (testing "Converts HTML to Hiccup (sanity check)"
    (is (= [[:foo#foo-id.clz1.clz2 "bar"]]
           (sut/html->hiccup "<foo id='foo-id' class='clz1 clz2'>bar</foo>"))))
  (testing "Text content is first non-prop arg"
    (is (= [[:foo#foo-id.clz1.clz2 "bar"]]
           (sut/html->hiccup "<foo id='foo-id' class='clz1 clz2'>bar</foo>")))
    (is (= [[:foo#foo-id.clz1.clz2 {:baz "gaz"} "bar"]]
           (sut/html->hiccup "<foo id='foo-id' class='clz1 clz2' baz=gaz>bar</foo>"))))
  (testing "Text content is trimmed"
    (is (= [[:foo "bar"]]
           (sut/html->hiccup "<foo>\n    bar\n \n </foo>")))
    (is (= [[:foo]]
           (sut/html->hiccup "<foo>\n\n  \n </foo>"))))
  (testing "Tag is lowercased"
    (is (= [[:foo]]
           (sut/html->hiccup "<FOO></Foo>"))))
  (testing "The id gets part of the tag"
    (is (= [[:foo#foo-id]]
           (sut/html->hiccup "<foo id='foo-id'></foo>"))))
  (testing "Invalid id-as-keyword does not get part of the tag"
    (is (= [[:foo {:id "foo-[id]"}]]
           (sut/html->hiccup "<foo id='foo-[id]'></foo>"))))
  (testing "Classes gets part of the tag"
    (is (= [[:foo.clz1.clz2]]
           (sut/html->hiccup "<foo class='clz1 clz2'></foo>"))))
  (testing "Classes gets part of the tag and trimmed"
    (is (= [[:foo.clz1.clz2]]
           (sut/html->hiccup "<foo class='clz1  clz2'></foo>"))))
  (testing "Valid kw-classes gets part of the tag, rest remains in class attr"
    (is (= [[:foo.clz1 {:class ["clz[2]"]}]]
           (sut/html->hiccup "<foo class='clz1 clz[2]'></foo>"))))
  (testing "When only invalid kw-classes they all remain in class attr"
    (is (= [[:foo {:class ["a/b" "clz[2]"]}]]
           (sut/html->hiccup "<foo class='a/b clz[2]'></foo>"))))
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
  (testing "Multiple top level elements with empty lines creates no extra whitespace nodes"
    (is (= [[:foo] [:bar]]
           (sut/html->hiccup "<foo></foo>\n\n<bar></bar>"))))
  (testing "Handle's self closing empty tags (XML style)"
    (is (= [[:foo]]
           (sut/html->hiccup "<foo/>"))))
  (testing "html comments `<!--...-->` becomes `(comment ...)`"
    (is (= [[:foo '(comment "...")]]
           (sut/html->hiccup "<foo><!-- ... --></foo>"))))
  (testing "Removes whitespace noise"
    (is (= [[:foo]]
           (sut/html->hiccup "<foo> \n </foo>"))))
  (testing "Handle's boolean attributes)"
    (is (= [[:foo {:disabled true}]]
           (sut/html->hiccup "<foo disabled></foo>")))
    (is (= [[:foo {:disabled "disabled"}]]
           (sut/html->hiccup "<foo disabled=disabled></foo")))
    (is (= [[:foo {:disabled "disabled"}]]
           (sut/html->hiccup "<foo disabled='disabled'></foo>")))))

(deftest html->hiccup-kebab-attrs?
  (testing "camelCase attributes are kebab-cased with :kebab-attrs? enabled"
    (is (= [[:foo {:on-change "bar" :max-height "10px"}]]
           (sut/html->hiccup "<foo onChange='bar' maxHeight='10px'></foo>" {:kebab-attrs? true}))))
  (testing "Special camelCase attributes are retained even when :kebab-attrs? enabled "
    (is (= [[:foo {:viewBox "foo-id" :baseProfile "clz1 clz2"}]]
           (sut/html->hiccup "<foo viewBox='foo-id' baseProfile='clz1 clz2'></foo>" {:kebab-attrs? true}))))
  (testing "Capitalized attributes are kebab-cased if :kebab-attrs? enabled"
    (is (= [[:foo {:on-change "bar" :maxheight "10px"}]]
           (sut/html->hiccup "<foo OnChange='bar' Maxheight='10px'></foo>" {:kebab-attrs? true}))))
  (testing "snake_case and SNAKE_CASE attributes are kebab-cased if :kebab-attrs? enabled"
    (is (= [[:foo {:on-change "bar" :max-height "10px"}]]
           (sut/html->hiccup "<foo ON_CHANGE='bar' max_height='10px'></foo>" {:kebab-attrs? true}))))
  (testing "UPPERCASE attributes are lowercased if :kebab-attrs? enabled"
    (is (= [[:foo {:onchange "bar"}]]
           (sut/html->hiccup "<foo ONCHANGE='bar'></foo>" {:kebab-attrs? true})))))

(deftest html->hiccup-style
  (testing "style attributes do not need whitespace between entries with mapify-style? disabled"
    (is (= [[:foo {:style "color:blue"}]]
           (sut/html->hiccup "<foo style='color:blue'></foo>" {:mapify-style? false}))))
  (testing "style attributes do not need whitespace between entries with mapify-style? enabled"
    (is (= [[:foo {:style {:color :blue}}]]
           (sut/html->hiccup "<foo style='color:blue'></foo>" {:mapify-style? true})))
    (is (= [[:foo {:style {:color :blue
                           :stroke :red}}]]
           (sut/html->hiccup "<foo style='color:blue;stroke:red;'></foo>" {:mapify-style? true})))))

(deftest html->hiccup-w-mapify-style?
  (testing "style attribute is mapified with :mapify-style? enabled"
    (is (= [[:foo {:style {:color :blue}}]]
           (sut/html->hiccup "<foo style='color: blue'></foo>" {:mapify-style? true}))))
  (testing "style attribute single bare word values are keywordized"
    (is (= [[:foo {:style {:background :none}}]]
           (sut/html->hiccup "<foo style='background: none'></foo>" {:mapify-style? true}))))
  (testing "style attribute single unit-less numeric values are left bare"
    (is (= [[:foo {:style {:border-width 1}}]]
           (sut/html->hiccup "<foo style='border-width: 1'></foo>" {:mapify-style? true})))
    (is (= [[:foo {:style {:border-width 0.5}}]]
           (sut/html->hiccup "<foo style='border-width: 0.5'></foo>" {:mapify-style? true}))))
  (testing "style attribute single numeric with unit is stringified"
    (is (= [[:foo {:style {:border-width "1em"}}]]
           (sut/html->hiccup "<foo style='border-width: 1em'></foo>" {:mapify-style? true}))))
  (testing "style attribute with multiple unit-less numeric values is stringified"
    ;; TODO: Make it a vector (some day, not trivial, because css attribute variables can be pretty complex)
    (is (= [[:foo {:style {:padding "0 0"}}]]
           (sut/html->hiccup "<foo style='padding: 0 0'></foo>" {:mapify-style? true}))))
  (testing "style attribute non-bare-word, non bare-numeric is stringified"
    (is (= [[:foo {:style {:padding "var(--some-padding, 0 0)"}}]]
           (sut/html->hiccup "<foo style='padding: var(--some-padding, 0 0);'></foo>" {:mapify-style? true})))))

  (deftest html->hiccup-wo-add-classes-to-tag-keyword?
    (testing "When the :add-classes-to-tag-keyword? option is false they all remain in class attr"
      (is (= [[:foo {:class ["clz1" "clz2"]}]]
             (sut/html->hiccup "<foo class='clz1 clz2'></foo>" {:add-classes-to-tag-keyword? false})))))