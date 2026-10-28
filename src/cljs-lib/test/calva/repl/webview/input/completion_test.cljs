(ns calva.repl.webview.input.completion-test
  (:require
   [calva.repl.webview.input.completion :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(deftest word-start
  (testing "the start of the word before the cursor, the way Calva finds words"
    (is (= 1 (sut/word-start "(string/upp)" 11)))
    (is (= 5 (sut/word-start "(foo :bar" 9)))
    (is (= 8 (sut/word-start "(deref @atom" 12))))
  (testing "after a leading syntax quote"
    (is (= 2 (sut/word-start "(`foo" 5))))
  (testing "the cursor when no word ends there"
    (is (= 1 (sut/word-start "( " 1)))
    (is (= 0 (sut/word-start "" 0)))))

(deftest valid-for?
  (is (true? (sut/valid-for? "string/up" "string/upper"))
      "Typing on narrows the candidates")
  (is (false? (sut/valid-for? "string" "string/u"))
      "A namespace separator asks again")
  (is (false? (sut/valid-for? "java" "java.l"))
      "A member separator asks again")
  (is (false? (sut/valid-for? "str" "st"))
      "Deleting into the prefix asks again"))

(deftest restart?
  (let [restart {:request 3 :from 1 :prefix "str" :options []}]
    (is (true? (sut/restart? restart "(stri)" 1 5))
        "The final answer fits the word the list shows")
    (is (false? (sut/restart? restart "(x stri)" 3 7))
        "Not for a word somewhere else")
    (is (false? (sut/restart? nil "(stri)" 1 5))
        "Not without a final answer")))

(deftest doc-blocks
  (is (= [[:code "(upper-case s)"] [:text "Converts string to all upper-case."]]
         (sut/doc-blocks "```clojure\n(upper-case s)\n```\n\nConverts string to all upper-case.\n"))
      "Fenced code, then text")
  (is (= [[:text "Returns its argument."]]
         (sut/doc-blocks "Returns its argument."))
      "Text without fences")
  (is (= [[:text "Returns a lazy sequence\n  of f applied."] [:text "Returns a transducer\n  without a collection."]]
         (sut/doc-blocks "Returns a lazy sequence\n  of f applied.\n\n  Returns a transducer\n  without a collection."))
      "A paragraph for each run of lines between blank lines"))

(deftest info-position
  (let [space {:left 0 :right 300 :top 0 :bottom 200}
        list {:left 10 :right 210 :top 60 :bottom 150}
        option {:left 10 :right 210 :top 130 :bottom 145}
        info {:left 0 :right 250 :top 0 :bottom 300}]
    (testing "a docs panel too wide to go beside the list"
      (is (= {:side "bottom" :offset 20 :max-width 260 :max-height 130 :class "cm-completionInfo-right-narrow"}
             (sut/info-position list option info space))
          "goes above the list when there is no room below, no taller than the room above the selected option")
      (is (= {:side "top" :offset 85 :max-width 260 :max-height 105 :class "cm-completionInfo-right-narrow"}
             (sut/info-position (assoc list :top 10 :bottom 100)
                                (assoc option :top 80 :bottom 95)
                                (assoc info :bottom 50)
                                space))
          "goes below the list when it fits there, no taller than the room below the selected option"))
    (testing "a docs panel that fits beside the list goes there, from the selected option down, kept in the view"
      (is (= {:side "top" :offset 10 :max-width 290 :max-height 130 :class "cm-completionInfo-right"}
             (sut/info-position (assoc list :left 0 :right 10)
                                option
                                (assoc info :right 200 :bottom 130)
                                space))
          "goes right of the list when there is room there")
      (is (= {:side "top" :offset 40 :max-width 200 :max-height 100 :class "cm-completionInfo-left"}
             (sut/info-position (assoc list :left 200 :right 290)
                                option
                                (assoc info :right 150 :bottom 100)
                                space))
          "goes left of the list when only the left has room"))))
