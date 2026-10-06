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
      (set! js/setTimeout (fn [f _] (reset! scheduled f) 0))
      (try
        (ui/show-copied! button)
        (is (= "Copied" (.getAttribute button "aria-label")))
        (is (= "true" (.-copied (.-dataset button))))
        (@scheduled)
        (is (= "Copy image-1 png 8 B" (.getAttribute button "aria-label")))
        (is (= "false" (.-copied (.-dataset button))))
        (finally
          (set! js/setTimeout original-timeout))))))
