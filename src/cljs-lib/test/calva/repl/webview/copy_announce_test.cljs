(ns calva.repl.webview.copy-announce-test
  (:require
   [calva.repl.webview.fake-document]
   [calva.repl.webview.ui :as ui]
   [cljs.test :refer-macros [deftest testing is]]))

(deftest show-copied-announces-test
  (testing "copy success updates the button accessible name, then restores it"
    (let [button (js/document.createElement "button")
          scheduled (atom nil)
          original-timeout js/setTimeout]
      (.setAttribute button "aria-label" "Copy image-1 png 8 B")
      (.setAttribute button "data-copy-label" "Copy image-1 png 8 B")
      (set! js/setTimeout (fn [f _] (reset! scheduled f) 0))
      (try
        (ui/show-copied! button)
        (is (= "Copied to clipboard" (.getAttribute button "aria-label")))
        (is (= "true" (.-copied (.-dataset button))))
        (@scheduled)
        (is (= "Copy image-1 png 8 B" (.getAttribute button "aria-label")))
        (is (= "false" (.-copied (.-dataset button))))
        (finally
          (set! js/setTimeout original-timeout))))))

(deftest show-copied-second-copy-restores-original-label
  (testing "a second copy before restore leaves the original label after the last timeout"
    (let [button (js/document.createElement "button")
          scheduled (atom [])
          original-timeout js/setTimeout
          original-clear js/clearTimeout]
      (.setAttribute button "aria-label" "Copy image-1 png 8 B")
      (.setAttribute button "data-copy-label" "Copy image-1 png 8 B")
      (set! js/setTimeout (fn [f _]
                            (let [id (inc (count @scheduled))]
                              (swap! scheduled conj {:id id :f f})
                              id)))
      (set! js/clearTimeout (fn [id]
                              (swap! scheduled (fn [xs] (vec (remove #(= id (:id %)) xs))))))
      (try
        (ui/show-copied! button)
        (ui/show-copied! button)
        (is (= "Copied to clipboard" (.getAttribute button "aria-label")))
        (is (= 1 (count @scheduled)))
        ((-> @scheduled first :f))
        (is (= "Copy image-1 png 8 B" (.getAttribute button "aria-label")))
        (finally
          (set! js/setTimeout original-timeout)
          (set! js/clearTimeout original-clear))))))

(deftest stdout-copy-button-test
  (let [output (js/document.createElement "div")
        _ (ui/create-and-append-stdout-element output (js/document.createTextNode "hello\n") "evalOut")
        pre (aget (.-children output) 0)
        [button text-node] (array-seq (.-children pre))]
    (is (= ["output-stdout"] (js->clj (.. pre -classList -names))))
    (is (= ["output-copy-button" "output-stdout-copy"] (js->clj (.. button -classList -names)))
        "The stdout element starts with its copy button")
    (is (nil? (.-title button)))
    (is (= "output-tooltip" (.getAttribute button "interestfor")))
    (is (= "Copy output" (.getAttribute button "aria-description"))
        "The copy button shows the page's tooltip")
    (is (= "Copy output" (.getAttribute button "data-copy-label"))
        "The accessible name comes back after the copied announcement")
    (is (= "hello\n" (.-textContent text-node))
        "The text follows the button")))
