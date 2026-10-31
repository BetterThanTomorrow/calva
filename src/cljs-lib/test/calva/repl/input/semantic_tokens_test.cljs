(ns calva.repl.input.semantic-tokens-test
  (:require
   [calva.repl.input.highlighting :as highlighting]
   [calva.repl.input.semantic-tokens :as sut]
   [cljs.test :refer-macros [deftest is testing async]]))

(def ^:private palette
  {:palette/token-rules [["entity.name.function" "#purple"]]
   :palette/semantic? true
   :palette/semantic-rules []})

(defn- state
  "Host state with the REPL Input `v` holding `text`, in a locked context, so the copy is the `ns` form and the text."
  [text]
  {:repl-input/records {"v" {:repl-input/text text}}
   :repl-input.context/line {:repl-input.context/ns-form "(ns a)"
                             :repl-input.context/locked? true}})

(defn- fake-adapter
  "An adapter that answers with `result`, and counts the requests in `!asked`."
  [!asked result]
  #js {:lspSemanticTokens (fn [_uri _text _line]
                            (swap! !asked inc)
                            (js/Promise.resolve result))})

(def ^:private one-function
  #js {:legend #js {:tokenTypes #js ["function"] :tokenModifiers #js []}
       :data #js [1 1 3 0 0]})

(defn- request+
  "Requests the semantic tokens of `v` and returns a promise of what was posted, after the answer."
  [adapter text]
  (let [!posted (atom [])]
    (with-redefs [highlighting/palette (constantly palette)]
      (sut/request! adapter (state text) "v" #(swap! !posted conj [%1 %2])))
    (js/Promise. (fn [resolve] (js/setTimeout #(resolve @!posted) 0)))))

(deftest request!-test
  (async done
    (let [!asked (atom 0)
          adapter (fake-adapter !asked one-function)]
      (reset! highlighting/!grammar #js {})
      (sut/forget! "v")
      (-> (request+ adapter "(foo)")
          (.then (fn [posted]
                   (testing "asks clojure-lsp and posts the text's ranges"
                     (is (= [["(foo)" [[1 4 "#purple"]]]] posted))
                     (is (= 1 @!asked)))
                   (request+ adapter "(foo)")))
          (.then (fn [posted]
                   (testing "posts the ranges it got again for the same request, without asking"
                     (is (= [["(foo)" [[1 4 "#purple"]]]] posted))
                     (is (= 1 @!asked)))
                   (request+ adapter "(foo) ")))
          (.then (fn [_]
                   (testing "asks again for another text"
                     (is (= 2 @!asked)))))
          (.finally (fn []
                      (sut/forget! "v")
                      (reset! highlighting/!grammar nil)
                      (done)))))))

(deftest request!-without-answer-test
  (async done
    (let [!asked (atom 0)
          adapter (fake-adapter !asked nil)]
      (reset! highlighting/!grammar #js {})
      (sut/forget! "v")
      (-> (request+ adapter "(foo)")
          (.then (fn [posted]
                   (testing "posts nothing without an answer"
                     (is (= [] posted)))
                   (request+ adapter "(foo)")))
          (.then (fn [_]
                   (testing "asks again for the same request after no answer"
                     (is (= 2 @!asked)))))
          (.finally (fn []
                      (sut/forget! "v")
                      (reset! highlighting/!grammar nil)
                      (done)))))))

(deftest request!-without-grammar-test
  (async done
    (let [!asked (atom 0)]
      (reset! highlighting/!grammar nil)
      (sut/forget! "v")
      (-> (request+ (fake-adapter !asked one-function) "(foo)")
          (.then (fn [posted]
                   (testing "asks for nothing before the grammar the tokens go over is loaded"
                     (is (= [] posted))
                     (is (= 0 @!asked)))))
          (.finally (fn []
                      (sut/forget! "v")
                      (done)))))))
