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
