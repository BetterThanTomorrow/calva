(ns calva.repl.webview.app-db-test
  (:require
   [calva.repl.webview.app-db :as sut]
   [calva.repl.webview.images :as images]
   [calva.repl.webview.stacktrace :as stacktrace]
   [calva.repl.webview.stacktrace-fixtures :as fixtures]
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

  (testing ":msg/set-word-wrap wraps the output and the REPL Input"
    (let [result (sut/handle-action sut/initial-db [:msg/set-word-wrap {:word-wrap true}])]
      (is (= sut/initial-db (:uf/db result)))
      (is (= [[:fx/set-word-wrap true]
              [:repl-input/fx.set-line-wrapping true]]
             (:uf/fxs result))))))

(deftest handle-action-set-code-theme-test
  (testing ":msg/set-code-theme"
    (let [result (sut/handle-action sut/initial-db [:msg/set-code-theme {:code-theme "dark"
                                                                         :token-colors {"keyword" "#ff7b72"}}])]
      (is (= sut/initial-db (:uf/db result)))
      (is (= [[:fx/set-code-theme "dark"]
              [:fx/set-token-colors {"keyword" "#ff7b72"}]]
             (:uf/fxs result))
          "The theme's code colors go over the code theme")))

  (testing ":msg/set-code-theme without token colors"
    (is (= [[:fx/set-code-theme "dark"]
            [:fx/set-token-colors nil]]
           (:uf/fxs (sut/handle-action sut/initial-db [:msg/set-code-theme {:code-theme "dark"}])))
        "Colors from an earlier theme go, and the code theme's colors show")))

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

(def runtime-causes (mapv stacktrace/cause-data fixtures/runtime-chain))

(defn- show-error
  [db message]
  (sut/handle-action db [:msg/error (merge {:command/name "show-error"
                                            :id "e1"
                                            :error/text "Execution error"
                                            :error/category "evalErr"}
                                           message)]))

(deftest error-with-frames-test
  (let [meta {:meta/who "ui" :meta/ns "my.ns" :meta/repl-session-key "clj"}
        {:uf/keys [db fxs]} (show-error sut/initial-db {:error/causes runtime-causes :meta meta})
        error (get-in db [:output/errors "e1"])]
    (is (= ["ui" "clj" nil nil "my.ns"] (:output/last-context db))
        "An error changes the context like other output")
    (is (= [[:fx/append-ns-info meta]
            [:fx/render-error error]]
           fxs)
        "Draws the error after the context")
    (is (false? (:error/unfolded? error))
        "The error arrives folded")
    (is (= runtime-causes (:error/causes error)))))

(deftest error-without-frames-test
  (let [causes [{:class "clojure.lang.ExceptionInfo" :message "cljs error" :stacktrace []}]
        {:uf/keys [db fxs]} (show-error sut/initial-db {:error/causes causes})
        error (get-in db [:output/errors "e1"])]
    (is (= [[:fx/render-error error]] fxs)
        "An error without frames is drawn too, as its own entry")
    (is (= causes (:error/causes error)))))

(deftest error-causes-arrive-later-test
  (let [db (:uf/db (show-error sut/initial-db {:error/causes []}))
        {later-db :uf/db fxs :uf/fxs} (sut/handle-action db [:msg/error-causes {:error/id "e1"
                                                                                :error/causes runtime-causes}])
        error (get-in later-db [:output/errors "e1"])]
    (is (= runtime-causes (:error/causes error))
        "The entry gets its causes")
    (is (= #{(dec (count runtime-causes))} (:error/unfolded-causes error))
        "The root cause shows its frames")
    (is (= [[:fx/render-error error]] fxs)
        "The entry is drawn again, with its stacktrace")
    (is (= {:uf/db sut/initial-db}
           (sut/handle-action sut/initial-db [:msg/error-causes {:error/id "e1" :error/causes runtime-causes}]))
        "Causes for an entry that is gone, as after clearing the view, change nothing")))

(deftest error-toggling-test
  (let [db (:uf/db (show-error sut/initial-db {:error/causes runtime-causes}))
        {unfolded-db :uf/db fxs :uf/fxs} (sut/handle-action db [:error/ax.toggle "e1"])
        unfolded (get-in unfolded-db [:output/errors "e1"])]
    (is (true? (:error/unfolded? unfolded)))
    (is (= [[:fx/render-error unfolded]] fxs)
        "Redraws the error")
    (is (= #{0 2} (get-in (sut/handle-action unfolded-db [:error/ax.toggle-cause {:error/id "e1" :cause/index 0}])
                          [:uf/db :output/errors "e1" :error/unfolded-causes]))
        "Unfolds the frames of one cause")
    (is (= {:uf/db db} (sut/handle-action db [:error/ax.toggle "no-such-error"]))
        "An unknown error changes nothing")))

(deftest open-frame-test
  (is (= [[:fx/post-to-host {:command "open-frame"
                             :fileUrl "file:/Users/me/myproj/src/myproj/core.clj"
                             :line 16
                             :column 5}]]
         (:uf/fxs (sut/handle-action sut/initial-db
                                     [:error/ax.open-frame {:frame/file-url "file:/Users/me/myproj/src/myproj/core.clj"
                                                            :frame/line 16
                                                            :frame/column 5}])))))

(deftest copy-error-test
  (let [db (:uf/db (show-error sut/initial-db {:error/causes runtime-causes}))
        error (get-in db [:output/errors "e1"])
        {copy-db :uf/db copy-fxs :uf/fxs} (sut/handle-action db [:error/ax.copy {:error/id "e1"}])]
    (is (= [[:fx/copy-error-text {:error/id "e1" :copy/text (stacktrace/filtered-text error)}]]
           copy-fxs)
        "Copies the error with the frames its filter shows")
    (is (= db copy-db)
        "Copying changes nothing in the Output view")))

(deftest copy-stdout-test
  (let [button #js {}]
    (is (= {:uf/db sut/initial-db
            :uf/fxs [[:fx/copy-stdout button]]}
           (sut/handle-action sut/initial-db [:output/ax.copy-stdout button]))
        "Copies the stdout of the clicked button's block")))

(deftest copy-image-test
  (let [image {:image/mime "image/png" :copy/button #js {}}]
    (is (= {:uf/db sut/initial-db
            :uf/fxs [[:fx/copy-image image]]}
           (sut/handle-action sut/initial-db [:output/ax.copy-image image]))
        "Copies the image of the clicked button")))

(deftest clear-output-view-forgets-errors-test
  (let [db (:uf/db (show-error sut/initial-db {:error/causes runtime-causes}))]
    (is (empty? (:output/errors (:uf/db (sut/handle-action db [:msg/clear-output-view])))))))

(deftest error-filters-test
  (let [db (:uf/db (show-error (:uf/db (show-error sut/initial-db {:error/causes runtime-causes}))
                               {:id "e2" :error/causes runtime-causes}))
        {flag-db :uf/db flag-fxs :uf/fxs} (sut/handle-action db [:error/ax.toggle-flag {:error/id "e1" :frame/flag "repl"}])
        {choice-db :uf/db} (sut/handle-action db [:error/ax.set-frame-filter {:error/id "e1" :error/frame-filter :project}])]
    (is (= #{"tooling" "dup" "repl"} (get-in flag-db [:output/errors "e1" :error/hidden-flags])))
    (is (= [[:fx/render-error (get-in flag-db [:output/errors "e1"])]] flag-fxs)
        "Redraws the error")
    (is (= #{"tooling" "dup"} (get-in flag-db [:output/errors "e2" :error/hidden-flags]))
        "Other errors keep their filters")
    (is (= :project (get-in choice-db [:output/errors "e1" :error/frame-filter])))
    (is (= :filtered (get-in choice-db [:output/errors "e2" :error/frame-filter])))))

(deftest open-java-frame-test
  (is (= [[:fx/post-to-host {:command "open-java-frame"
                             :className "java.lang.Integer"
                             :member "parseInt"
                             :line 662
                             :sessionKey "clj"}]]
         (:uf/fxs (sut/handle-action sut/initial-db
                                     [:error/ax.open-java-frame {:frame/qualifier "java.lang.Integer"
                                                                 :frame/name "parseInt"
                                                                 :frame/line 662
                                                                 :error/session-key "clj"}])))))
