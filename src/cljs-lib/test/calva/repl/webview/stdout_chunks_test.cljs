(ns calva.repl.webview.stdout-chunks-test
  (:require
   [calva.repl.webview.fake-document :as fake-document]
   [calva.repl.webview.ui :as ui]
   [cljs.test :refer-macros [deftest is testing use-fixtures]]
   [clojure.string :as string]))

(use-fixtures :each (fn [f] (with-redefs [ui/insert-hiccup! fake-document/insert-hiccup!] (f))))

(defn- lines
  "Returns `n` lines of `width` characters each, the newline included."
  [n width]
  (apply str (repeat n (str (apply str (repeat (dec width) "x")) "\n"))))

(deftest stdout-chunks-test
  (testing "text that fits the room goes to the last block"
    (is (= ["abc"] (ui/stdout-chunks "abc" 10))))
  (testing "without room, the text starts a new block"
    (is (= ["" "abc"] (ui/stdout-chunks "abc" 0))))
  (testing "a line that doesn't fit the room starts a new block, instead of being cut in two"
    (is (= ["" "a line of thirty-two characters\n"] (ui/stdout-chunks "a line of thirty-two characters\n" 30))))
  (testing "the room takes the lines that fit it"
    (is (= ["one\ntwo\n" "three\n"] (ui/stdout-chunks "one\ntwo\nthree\n" 10))))
  (testing "a long text is cut after a newline in the latter half of the room"
    (let [text (lines 300 100)
          chunks (ui/stdout-chunks text 250)]
      (is (= text (apply str chunks)) "Nothing is lost or added")
      (is (= 200 (count (first chunks))) "The first piece ends after the last newline that fits the room")
      (is (every? #(<= (count %) ui/stdout-chunk-size) (rest chunks)))
      (is (every? #(string/ends-with? % "\n") (butlast chunks)) "Each piece but the last ends with a newline")))
  (testing "a text without newlines is cut at the limit"
    (let [text (apply str (repeat 25000 "y"))]
      (is (= [0 10000 10000 5000] (mapv count (ui/stdout-chunks text 0)))))))

(defn- stdout-blocks
  [^js output]
  (mapv (fn [^js block]
          {:text-length (count (.-textContent block))
           :continues? (.hasAttribute block "data-continues")
           :category (.getAttribute block "data-output-element-type")})
        (.-children output)))

(deftest append-stdout-test
  (testing "consecutive stdout of a category fills a block, then continues in new ones"
    (let [output (fake-document/hiccup-element [:div {:id "output"}])]
      (ui/append-stdout output (lines 50 100) "evalOut")
      (ui/append-stdout output (lines 150 100) "evalOut")
      (is (= [{:text-length 10000 :continues? false :category "evalOut"}
              {:text-length 10000 :continues? true :category "evalOut"}]
             (stdout-blocks output)))))
  (testing "another category starts its own run"
    (let [output (fake-document/hiccup-element [:div {:id "output"}])]
      (ui/append-stdout output "out\n" "evalOut")
      (ui/append-stdout output "err\n" "evalErr")
      (is (= [false false] (mapv :continues? (stdout-blocks output)))))))

(deftest copy-output-copies-the-run-test
  (let [output (fake-document/hiccup-element [:div {:id "output"}])
        copied (atom nil)
        clipboard (.-clipboard js/navigator)]
    (ui/append-stdout output "before\n" "evalErr")
    (ui/append-stdout output (lines 150 100) "evalOut")
    (ui/append-stdout output "after\n" "evalErr")
    (set! (.-clipboard js/navigator) #js {:writeText (fn [text] (reset! copied text) (js/Promise.resolve))})
    (try
      (let [^js second-chunk (aget (.-children output) 2)
            button (.querySelector second-chunk "button")]
        (ui/exec-effect! output [:fx/copy-stdout button])
        (is (= (lines 150 100) @copied) "The whole run of the category is copied, from any of its blocks"))
      (finally
        (set! (.-clipboard js/navigator) clipboard)))))
