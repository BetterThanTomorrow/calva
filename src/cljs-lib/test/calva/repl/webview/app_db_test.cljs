(ns calva.repl.webview.app-db-test
  (:require
   [calva.repl.webview.app-db :as sut]
   [calva.repl.webview.images :as images]
   [cljs.test :refer-macros [deftest testing is]]))

(deftest initial-db-test
  (testing "initial-db has nil :output/last-context"
    (is (nil? (:output/last-context sut/initial-db)))))

(deftest handle-action-test
  (testing ":msg/clear-output-view action"
    (let [db {:output/last-context ["who" "session" "build" 1 "my.ns"]}
          result (sut/handle-action db [:msg/clear-output-view])]
      (is (nil? (get-in result [:uf/db :output/last-context])))
      (is (= [[:fx/clear-dom]] (:uf/fxs result)))))

  (testing ":msg/output with new context"
    (let [meta {:meta/who "tester" :meta/ns "my.ns" :meta/repl-session-key "clj"}
          payload {:command/name "show-result" :output "42" :meta meta}
          result (sut/handle-action sut/initial-db [:msg/output payload])]
      (is (= ["tester" "clj" nil nil "my.ns"] (get-in result [:uf/db :output/last-context])))
      (is (= [[:fx/append-ns-info meta]
              [:fx/append-result "42"]]
             (:uf/fxs result)))))

  (testing ":msg/output with unchanged context"
    (let [meta {:meta/who "tester" :meta/ns "my.ns" :meta/repl-session-key "clj"}
          db {:output/last-context ["tester" "clj" nil nil "my.ns"]}
          payload {:command/name "show-result" :output "42" :meta meta}
          result (sut/handle-action db [:msg/output payload])]
      (is (= ["tester" "clj" nil nil "my.ns"] (get-in result [:uf/db :output/last-context])))
      (is (= [[:fx/append-result "42"]] (:uf/fxs result)))))

  (testing ":msg/output show-stdout with an output-category"
    (let [payload {:command/name "show-stdout" :output "text" :output-category "otherOut"}
          result (sut/handle-action sut/initial-db [:msg/output payload])]
      (is (= [[:fx/append-stdout "text" "otherOut"]] (:uf/fxs result)))))

  (testing ":msg/output show-stdout without an output-category defaults to evalOut"
    (let [payload {:command/name "show-stdout" :output "text"}
          result (sut/handle-action sut/initial-db [:msg/output payload])]
      (is (= [[:fx/append-stdout "text" "evalOut"]] (:uf/fxs result)))))

  (testing ":msg/set-code-theme"
    (let [result (sut/handle-action sut/initial-db [:msg/set-code-theme {:code-theme "dark"}])]
      (is (= sut/initial-db (:uf/db result)))
      (is (= [[:fx/set-code-theme "dark"]] (:uf/fxs result)))))

  (testing ":msg/set-word-wrap"
    (let [result (sut/handle-action sut/initial-db [:msg/set-word-wrap {:word-wrap true}])]
      (is (= sut/initial-db (:uf/db result)))
      (is (= [[:fx/set-word-wrap true]] (:uf/fxs result)))))

  (testing ":msg/scroll-to"
    (let [result (sut/handle-action sut/initial-db [:msg/scroll-to {:x 0 :y 100}])]
      (is (= sut/initial-db (:uf/db result)))
      (is (= [[:fx/scroll-to {:x 0 :y 100}]] (:uf/fxs result))))))

(def png-data-url "data:image/png;base64,iVBORw0KGgo=")

(def png-image {:image/n 1
                :image/mime "image/png"
                :image/subtype "png"
                :image/size "8 B"
                :image/data-url png-data-url
                :image/line-index 0
                :image/line-offset 0})

(def png-image-in-quotes
  (assoc png-image :image/line-offset 1))

(deftest images-test
  (testing "a result with an image is appended with placeholder text, images and the raw text"
    (let [output (str "\"" png-data-url "\"")
          payload {:command/name "show-result" :output output}
          result (sut/handle-action sut/initial-db [:msg/output payload])]
      (is (= [[:fx/append-result-with-images {:text "\"<<image-1 png 8 B>>\""
                                              :images [png-image-in-quotes]
                                              :raw output}]]
             (:uf/fxs result)))))

  (testing "show-result keeps meta on the images fx for session-root resolve"
    (let [output (str "\"" png-data-url "\"")
          meta {:meta/repl-session-key "clj" :meta/ns "user"}
          payload {:command/name "show-result" :output output :meta meta}
          result (sut/handle-action sut/initial-db [:msg/output payload])
          images-fx (some (fn [[op payload]]
                            (when (= :fx/append-result-with-images op)
                              payload))
                          (:uf/fxs result))]
      (is (= meta (:meta images-fx)))))

  (testing "stdout with a data URL is plain append-stdout"
    (let [output (str png-data-url "\n")
          payload {:command/name "show-stdout" :output output :output-category "evalOut"}
          result (sut/handle-action sut/initial-db [:msg/output payload])]
      (is (= [[:fx/append-stdout output "evalOut"]]
             (:uf/fxs result)))))

  (testing "two images on one line are two images, in order"
    (let [jpeg-data-url "data:image/jpeg;base64,/9j/4AAQ"
          output (str png-data-url " " jpeg-data-url)
          result (sut/handle-action sut/initial-db [:msg/output {:command/name "show-result" :output output}])
          [[_ {:keys [text images]}]] (:uf/fxs result)]
      (is (= "<<image-1 png 8 B>> <<image-2 jpeg 6 B>>" text))
      (is (= [png-data-url jpeg-data-url] (map :image/data-url images)))))

  (testing "a result without images is appended as before"
    (let [result (sut/handle-action sut/initial-db [:msg/output {:command/name "show-result" :output "42"}])]
      (is (= [[:fx/append-result "42"]] (:uf/fxs result)))))

  (testing "evaluated code is left raw"
    (let [payload {:command/name "show-evaluated-code" :output (str "\"" png-data-url "\"")}
          result (sut/handle-action sut/initial-db [:msg/output payload])]
      (is (= [[:fx/append-evaluated-code (str "\"" png-data-url "\"")]]
             (:uf/fxs result)))))

  (testing ":msg/set-image-display gives a set-image-display fx and leaves the db as is"
    (let [result (sut/handle-action sut/initial-db [:msg/set-image-display {:command/name "set-image-display"
                                                                            :image-display "raw"}])]
      (is (= sut/initial-db (:uf/db result)))
      (is (= [[:fx/set-image-display "raw"]] (:uf/fxs result))))))

(deftest compute-effective-scale-test
  (testing "combines base scale and adjustment"
    (is (= 1.1 (sut/compute-effective-scale {:output/base-font-scale 1.0 :output/font-size-adjustment 0.1}))))

  (testing "defaults missing keys to 1.0 and 0.0"
    (is (= 1.0 (sut/compute-effective-scale {}))))

  (testing "clamps to a minimum of 0.5"
    (is (= 0.5 (sut/compute-effective-scale {:output/base-font-scale 0.4 :output/font-size-adjustment -0.5}))))

  (testing "clamps to a maximum of 1.5"
    (is (= 1.5 (sut/compute-effective-scale {:output/base-font-scale 1.4 :output/font-size-adjustment 0.5}))))

  (testing "rounds to two decimal places"
    (is (= 1.23 (sut/compute-effective-scale {:output/base-font-scale 1.0 :output/font-size-adjustment 0.234})))))

(deftest set-base-font-scale-test
  (testing ":msg/set-base-font-scale sets the base scale and returns the effective scale fx"
    (let [result (sut/handle-action sut/initial-db [:msg/set-base-font-scale {:scale 1.5}])]
      (is (= 1.5 (get-in result [:uf/db :output/base-font-scale])))
      (is (= [[:fx/set-font-scale 1.5]] (:uf/fxs result)))))

  (testing "defaults to 1.0 when no scale is given"
    (let [result (sut/handle-action sut/initial-db [:msg/set-base-font-scale {}])]
      (is (= 1.0 (get-in result [:uf/db :output/base-font-scale])))
      (is (= [[:fx/set-font-scale 1.0]] (:uf/fxs result))))))

(deftest adjust-font-size-test
  (testing ":msg/adjust-font-size increases the adjustment by the given delta"
    (let [result (sut/handle-action sut/initial-db [:msg/adjust-font-size {:delta 0.1}])]
      (is (= 0.1 (get-in result [:uf/db :output/font-size-adjustment])))
      (is (= [[:fx/set-font-scale 1.1]] (:uf/fxs result)))))

  (testing "accumulates on top of an existing adjustment"
    (let [db (assoc sut/initial-db :output/font-size-adjustment 0.2)
          result (sut/handle-action db [:msg/adjust-font-size {:delta 0.1}])]
      (is (< (js/Math.abs (- 0.3 (get-in result [:uf/db :output/font-size-adjustment]))) 0.0001))))

  (testing "defaults to a delta of 0.1 when none given"
    (let [result (sut/handle-action sut/initial-db [:msg/adjust-font-size {}])]
      (is (= 0.1 (get-in result [:uf/db :output/font-size-adjustment]))))))

(deftest reset-font-size-test
  (testing ":msg/reset-font-size resets the adjustment to 0.0"
    (let [db (assoc sut/initial-db :output/font-size-adjustment 0.5)
          result (sut/handle-action db [:msg/reset-font-size {}])]
      (is (= 0.0 (get-in result [:uf/db :output/font-size-adjustment])))
      (is (= [[:fx/set-font-scale 1.0]] (:uf/fxs result))))))

(deftest image-lines-always-emit-with-images-and-raw-test
  (testing "stderr image-looking lines stay plain append-stdout"
    (doseq [output ["/tmp/no-such-image.png\n"
                    "https://raw.githubusercontent.com/BetterThanTomorrow/calva/dev/assets/calva.png\n"
                    "/tmp/calva-symbol.svg\n"
                    (str png-data-url "\n")]]
      (let [result (sut/handle-action sut/initial-db
                                      [:msg/output {:command/name "show-stdout"
                                                    :output output
                                                    :output-category "evalErr"}])]
        (is (= [[:fx/append-stdout output "evalErr"]] (:uf/fxs result))
            (str "stderr stays plain append-stdout: " output)))))
  (testing "result image path or URL always gets with-images, with :raw as printed"
    (doseq [output ["\"/tmp/cat.png\""
                    "\"https://example.com/a.png\""]]
      (let [result (sut/handle-action sut/initial-db
                                      [:msg/output {:command/name "show-result"
                                                    :output output}])
            [[op payload]] (:uf/fxs result)]
        (is (= :fx/append-result-with-images op)
            (str "result image line uses with-images: " output))
        (is (= output (:raw payload))
            (str "raw form payload is exact printed text: " output))
        (is (seq (:images payload))))))
  (testing "stdout without an image extension stays plain append-stdout"
    (let [result (sut/handle-action sut/initial-db
                                    [:msg/output {:command/name "show-stdout"
                                                  :output "hello\n"
                                                  :output-category "evalOut"}])]
      (is (= [[:fx/append-stdout "hello\n" "evalOut"]] (:uf/fxs result))))))

(deftest nested-result-image-strings-test
  (testing "a result with nested image path strings gets one image per match"
    (let [output (pr-str {:icon "calva-symbol.svg" :logo "https://example.com/x.png"})
          result (sut/handle-action sut/initial-db [:msg/output {:command/name "show-result" :output output}])
          [[_ {:keys [text images raw]}]] (:uf/fxs result)]
      (is (= output text))
      (is (= output raw))
      (is (= ["calva-symbol.svg" "https://example.com/x.png"] (mapv :image/src images)))
      (is (= [:local :remote] (mapv :image/kind images)))))
  (testing "stdout never extracts images"
    (let [output (str (pr-str {:icon "calva-symbol.svg"}) "\n")
          result (sut/handle-action sut/initial-db [:msg/output {:command/name "show-stdout"
                                                                  :output output
                                                                  :output-category "evalOut"}])]
      (is (= [[:fx/append-stdout output "evalOut"]] (:uf/fxs result)))))
  (testing "show-stdout with a data URL only appends stdout"
    (let [output (str png-data-url "\n")
          result (sut/handle-action sut/initial-db [:msg/output {:command/name "show-stdout"
                                                                  :output output
                                                                  :output-category "evalOut"}])]
      (is (= [[:fx/append-stdout output "evalOut"]] (:uf/fxs result))))))

(deftest payload-budget-result-uses-both-forms-test
  (testing "an over-budget data URL is a marker in the image form and the original text in :raw"
    (try
      (reset! images/!max-result-data-url-payload-chars 4)
      (let [output (str "\"" png-data-url "\"")
            result (sut/handle-action sut/initial-db [:msg/output {:command/name "show-result"
                                                                    :output output}])
            [[op payload]] (:uf/fxs result)]
        (is (= :fx/append-result-with-images op))
        (is (= "\"<<image png 8 B>>\"" (:text payload)))
        (is (= output (:raw payload)))
        (is (= [] (:images payload))))
      (finally
        (reset! images/!max-result-data-url-payload-chars nil)))))
