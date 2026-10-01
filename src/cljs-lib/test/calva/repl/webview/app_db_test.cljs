(ns calva.repl.webview.app-db-test
  (:require
   [calva.repl.webview.app-db :as sut]
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
                :image/data-url png-data-url})

(deftest render-images-test
  (testing "initial-db renders images"
    (is (true? (:output/render-images? sut/initial-db))))

  (testing "a result with an image gets a placeholder in the text and an append-images fx"
    (let [payload {:command/name "show-result" :output (str "\"" png-data-url "\"")}
          result (sut/handle-action sut/initial-db [:msg/output payload])]
      (is (= [[:fx/append-result "\"<<image-1 png 8 B>>\""]
              [:fx/append-images [png-image]]]
             (:uf/fxs result)))))

  (testing "stdout with an image gets a placeholder in the text and an append-images fx"
    (let [payload {:command/name "show-stdout" :output (str png-data-url "\n") :output-category "evalOut"}
          result (sut/handle-action sut/initial-db [:msg/output payload])]
      (is (= [[:fx/append-stdout "<<image-1 png 8 B>>\n" "evalOut"]
              [:fx/append-images [png-image]]]
             (:uf/fxs result)))))

  (testing "evaluated code is left raw"
    (let [payload {:command/name "show-evaluated-code" :output (str "\"" png-data-url "\"")}
          result (sut/handle-action sut/initial-db [:msg/output payload])]
      (is (= [[:fx/append-evaluated-code (str "\"" png-data-url "\"")]]
             (:uf/fxs result)))))

  (testing "with rendering off, output is left raw"
    (let [db (assoc sut/initial-db :output/render-images? false)
          payload {:command/name "show-result" :output (str "\"" png-data-url "\"")}
          result (sut/handle-action db [:msg/output payload])]
      (is (= [[:fx/append-result (str "\"" png-data-url "\"")]]
             (:uf/fxs result)))))

  (testing ":msg/set-render-images sets the flag"
    (is (false? (get-in (sut/handle-action sut/initial-db [:msg/set-render-images {:render-images? false}])
                        [:uf/db :output/render-images?])))
    (is (true? (get-in (sut/handle-action (assoc sut/initial-db :output/render-images? false)
                                          [:msg/set-render-images {:render-images? true}])
                       [:uf/db :output/render-images?])))))

(defn- stdout
  ([text] (stdout text "evalOut"))
  ([text category] [:msg/output {:command/name "show-stdout" :output text :output-category category}]))

(defn- run-actions
  "Runs `actions` through `handle-action` from `db`. Returns the last db and all fxs in order."
  [db actions]
  (reduce (fn [{:keys [db fxs]} action]
            (let [result (sut/handle-action db action)]
              {:db (:uf/db result) :fxs (into fxs (:uf/fxs result))}))
          {:db db :fxs []}
          actions))

(defn- chunks
  [text n]
  (let [size (js/Math.ceil (/ (count text) n))]
    (map #(apply str %) (partition-all size text))))

(def split-data-url (str "data:image/png;base64," (apply str (repeat 1600 "A")) "=="))

(def split-image {:image/n 1
                  :image/mime "image/png"
                  :image/subtype "png"
                  :image/size "1 kB"
                  :image/data-url split-data-url})

(deftest pending-stdout-test
  (testing "a data URL split across two stdout chunks is one image"
    (let [{:keys [db fxs]} (run-actions sut/initial-db
                                        (map stdout (chunks (str "before " split-data-url "\nafter\n") 2)))]
      (is (nil? (:output/pending-stdout db)))
      (is (= [[:fx/append-stdout "before " "evalOut"]
              [:fx/append-stdout "<<image-1 png 1 kB>>\nafter\n" "evalOut"]
              [:fx/append-images [split-image]]]
             fxs))))

  (testing "a data URL split across three stdout chunks is one image"
    (let [{:keys [db fxs]} (run-actions sut/initial-db
                                        (map stdout (chunks (str split-data-url "\n") 3)))]
      (is (nil? (:output/pending-stdout db)))
      (is (= [[:fx/append-stdout "<<image-1 png 1 kB>>\n" "evalOut"]
              [:fx/append-images [split-image]]]
             fxs))))

  (testing "a chunk that ends inside the data URL header is held back"
    (let [{:keys [db fxs]} (run-actions sut/initial-db [(stdout "look: data:image/pn")])]
      (is (= {:text "data:image/pn" :category "evalOut"} (:output/pending-stdout db)))
      (is (= [[:fx/append-stdout "look: " "evalOut"]] fxs))))

  (testing "a result flushes pending stdout before it"
    (let [{:keys [db fxs]} (run-actions sut/initial-db
                                        [(stdout "data:image/png;base64,AAAA")
                                         [:msg/output {:command/name "show-result" :output "nil"}]])]
      (is (nil? (:output/pending-stdout db)))
      (is (= [[:fx/append-stdout "<<image-1 png 3 B>>" "evalOut"]
              [:fx/append-images [{:image/n 1
                                   :image/mime "image/png"
                                   :image/subtype "png"
                                   :image/size "3 B"
                                   :image/data-url "data:image/png;base64,AAAA"}]]
              [:fx/append-result "nil"]]
             fxs))))

  (testing "stdout of another category flushes pending stdout before it"
    (let [{:keys [fxs]} (run-actions sut/initial-db
                                     [(stdout "x data:ima")
                                      (stdout "boom\n" "evalErr")])]
      (is (= [[:fx/append-stdout "x " "evalOut"]
              [:fx/append-stdout "data:ima" "evalOut"]
              [:fx/append-stdout "boom\n" "evalErr"]]
             fxs))))

  (testing "clearing the output view drops pending stdout"
    (let [{:keys [db]} (run-actions sut/initial-db
                                    [(stdout "data:image/png;base64,AAAA")
                                     [:msg/clear-output-view]])]
      (is (nil? (:output/pending-stdout db)))))

  (testing "with rendering off, stdout is not held back"
    (let [{:keys [db fxs]} (run-actions (assoc sut/initial-db :output/render-images? false)
                                        [(stdout "data:image/png;base64,AAAA")])]
      (is (nil? (:output/pending-stdout db)))
      (is (= [[:fx/append-stdout "data:image/png;base64,AAAA" "evalOut"]] fxs)))))

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
