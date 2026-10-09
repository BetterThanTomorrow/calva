(ns calva.repl.webview.app-db-test
  (:require
   [calva.repl.webview.app-db :as sut]
   [calva.repl.webview.images :as images]
   [clojure.string :as str]
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

  (testing "stdout with an image is appended with placeholder text, images and the raw text"
    (let [output (str png-data-url "\n")
          payload {:command/name "show-stdout" :output output :output-category "evalOut"}
          result (sut/handle-action sut/initial-db [:msg/output payload])]
      (is (= [[:fx/append-stdout-with-images {:text "<<image-1 png 8 B>>\n"
                                              :images [png-image]
                                              :raw output}
               "evalOut"]]
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
                  :image/data-url split-data-url
                  :image/line-index 0
                  :image/line-offset 0})

(deftest pending-stdout-test
  (testing "a data URL split across two stdout chunks stays on one line with its prefix"
    (let [{:keys [db fxs]} (run-actions sut/initial-db
                                        (map stdout (chunks (str "before " split-data-url "\nafter\n") 2)))]
      (is (nil? (:output/pending-stdout db)))
      (is (= [[:fx/append-stdout-with-images {:text "before <<image-1 png 1 kB>>\nafter\n"
                                              :images [(assoc split-image :image/line-offset 7)]
                                              :raw (str "before " split-data-url "\nafter\n")}
               "evalOut"]]
             fxs))))

  (testing "a data URL split across three stdout chunks is one image"
    (let [{:keys [db fxs]} (run-actions sut/initial-db
                                        (map stdout (chunks (str split-data-url "\n") 3)))]
      (is (nil? (:output/pending-stdout db)))
      (is (= [[:fx/append-stdout-with-images {:text "<<image-1 png 1 kB>>\n"
                                              :images [split-image]
                                              :raw (str split-data-url "\n")}
               "evalOut"]]
             fxs))))

  (testing "a chunk that ends inside the data URL header keeps the prefix with the pending tail"
    (let [{:keys [db fxs]} (run-actions sut/initial-db [(stdout "look: data:image/pn")])]
      (is (= {:text "data:image/pn" :prefix "look: " :category "evalOut"}
             (select-keys (:output/pending-stdout db) [:text :prefix :category])))
      (is (= [] fxs))))

  (testing "a short pending prefix flushes as plain text when a result arrives"
    (let [{:keys [db fxs]} (run-actions sut/initial-db
                                        [(stdout "end d")
                                         [:msg/output {:command/name "show-result" :output "nil"}]])]
      (is (nil? (:output/pending-stdout db)))
      (is (= [[:fx/append-stdout "end d" "evalOut"]
              [:fx/append-result "nil"]]
             fxs))))

  (testing "a short pending prefix flushes as plain text on :msg/flush-pending-stdout"
    (let [{:keys [db fxs]} (run-actions sut/initial-db
                                        [(stdout "end d")
                                         [:msg/flush-pending-stdout]])]
      (is (nil? (:output/pending-stdout db)))
      (is (= [[:fx/append-stdout "end d" "evalOut"]] fxs))))

  (testing "a chunk ending in a newline does not hold a short trailing d"
    (let [{:keys [db fxs]} (run-actions sut/initial-db [(stdout "end d\n")])]
      (is (nil? (:output/pending-stdout db)))
      (is (= [[:fx/append-stdout "end d\n" "evalOut"]] fxs))))

  (testing "a result flushes pending stdout before it"
    (let [{:keys [db fxs]} (run-actions sut/initial-db
                                        [(stdout "data:image/png;base64,AAAA")
                                         [:msg/output {:command/name "show-result" :output "nil"}]])]
      (is (nil? (:output/pending-stdout db)))
      (is (= [[:fx/append-stdout-with-images {:text "<<image-1 png 3 B>>"
                                              :images [{:image/n 1
                                                        :image/mime "image/png"
                                                        :image/subtype "png"
                                                        :image/size "3 B"
                                                        :image/data-url "data:image/png;base64,AAAA"
                                                        :image/line-index 0
                                                        :image/line-offset 0}]
                                              :raw "data:image/png;base64,AAAA"}
               "evalOut"]
              [:fx/append-result "nil"]]
             fxs))))

  (testing "stdout of another category flushes pending stdout before it"
    (let [{:keys [fxs]} (run-actions sut/initial-db
                                     [(stdout "x data:ima")
                                      (stdout "boom\n" "evalErr")])]
      (is (= [[:fx/append-stdout "x data:ima" "evalOut"]
              [:fx/append-stdout "boom\n" "evalErr"]]
             fxs))))

  (testing "clearing the output view drops pending stdout"
    (let [{:keys [db]} (run-actions sut/initial-db
                                    [(stdout "data:image/png;base64,AAAA")
                                     [:msg/clear-output-view]])]
      (is (nil? (:output/pending-stdout db))))))

(deftest pending-stdout-bound-test
  (testing "an endless unterminated data-URL stream stays bounded and falls back to text"
    (let [header "data:image/png;base64,"
          chunk (apply str (repeat 4096 "A"))
          ;; Well past the 1 MB pending cap; old code would grow without bound.
          n (inc (quot images/max-pending-stdout-chars (count chunk)))
          actions (into [(stdout header)] (repeat n (stdout chunk)))
          {:keys [db fxs]} (run-actions sut/initial-db actions)
          pending-text (get-in db [:output/pending-stdout :text])
          raw-fxs (filter (fn [[op text]]
                           (and (= :fx/append-stdout op)
                                (string? text)
                                (str/starts-with? text header)))
                         fxs)
          image-fxs (filter (fn [[op]] (= :fx/append-stdout-with-images op)) fxs)]
      (is (nil? pending-text))
      (is (seq raw-fxs))
      (is (empty? image-fxs))
      (is (every? #(<= (count (second %)) (+ images/max-pending-stdout-chars (count chunk)))
                  raw-fxs))))

  (testing "a payload split across many chunks still becomes one image"
    (let [payload (apply str (repeat 8000 "A"))
          url (str "data:image/png;base64," payload "==")
          piece 200
          actions (map stdout (concat (map #(apply str %)
                                           (partition-all piece url))
                                      ["\n"]))
          {:keys [db fxs]} (run-actions sut/initial-db actions)
          image-fxs (filter (fn [[op]] (= :fx/append-stdout-with-images op)) fxs)]
      (is (nil? (:output/pending-stdout db)))
      (is (= 1 (count image-fxs)))
      (is (= url (get-in (first image-fxs) [1 :images 0 :image/data-url])))))

  (testing "many open-payload chunks stay fast"
    ;; 5 s only catches a quadratic rescan of the whole pending buffer per chunk.
    (let [header "data:image/png;base64,"
          chunk (apply str (repeat 1024 "A"))
          n 2000
          actions (into [(stdout header)] (repeat n (stdout chunk)))
          t0 (.now js/Date)
          {:keys [db]} (run-actions sut/initial-db actions)
          elapsed (- (.now js/Date) t0)
          pending-len (count (or (get-in db [:output/pending-stdout :text]) ""))]
      (is (<= pending-len images/max-pending-stdout-chars))
      (is (< elapsed 5000)
          (str "expected under 5000ms, took " elapsed "ms")))))

(defn- run-two-eval-out
  "Runs two evalOut stdout messages, first as context a then as context b."
  [output-a output-b]
  (let [meta-a {:meta/who "a" :meta/ns "a.ns" :meta/repl-session-key "clj"}
        meta-b {:meta/who "b" :meta/ns "b.ns" :meta/repl-session-key "clj"}
        {:keys [db fxs]} (run-actions sut/initial-db
                                      [[:msg/output {:command/name "show-stdout"
                                                     :output output-a
                                                     :output-category "evalOut"
                                                     :meta meta-a}]
                                       [:msg/output {:command/name "show-stdout"
                                                     :output output-b
                                                     :output-category "evalOut"
                                                     :meta meta-b}]])]
    {:db db :fxs fxs :meta-a meta-a :meta-b meta-b}))

(def ^:private flushed-aaaa-stdout-fx
  [:fx/append-stdout-with-images {:text "<<image-1 png 3 B>>"
                                  :images [{:image/n 1
                                            :image/mime "image/png"
                                            :image/subtype "png"
                                            :image/size "3 B"
                                            :image/data-url "data:image/png;base64,AAAA"
                                            :image/line-index 0
                                            :image/line-offset 0}]
                                  :raw "data:image/png;base64,AAAA"}
   "evalOut"])

(deftest pending-stdout-context-test
  (testing "a context change flushes pending stdout and does not join the new context"
    (let [{:keys [db fxs meta-a meta-b]} (run-two-eval-out "data:image/png;base64,AAAA" "from-b\n")]
      (is (nil? (:output/pending-stdout db)))
      (is (= ["b" "clj" nil nil "b.ns"] (:output/last-context db)))
      (is (= [[:fx/append-ns-info meta-a]
              flushed-aaaa-stdout-fx
              [:fx/append-ns-info meta-b]
              [:fx/append-stdout "from-b\n" "evalOut"]]
             fxs))))

  (testing "a context change leaves only the new context's pending tail"
    (let [{:keys [db fxs meta-a meta-b]} (run-two-eval-out "data:image/png;base64,AAAA" "data:image/png;a=b;c=")]
      (is (= {:text "data:image/png;a=b;c=" :category "evalOut"} (select-keys (:output/pending-stdout db) [:text :category])))
      (is (= ["b" "clj" nil nil "b.ns"] (:output/last-context db)))
      (is (= [[:fx/append-ns-info meta-a]
              flushed-aaaa-stdout-fx
              [:fx/append-ns-info meta-b]]
             fxs)))))

(deftest pending-stdout-mime-parameters-test
  (testing "a parameterised header split across stdout chunks stays on one line with its prefix"
    (let [url "data:image/svg+xml;charset=utf-8;base64,PHN2Zz4="
          {:keys [db fxs]} (run-actions sut/initial-db
                                        [(stdout "look: data:image/svg+xml;char")
                                         (stdout "set=utf-8;base64,PHN2Zz4=\n")])]
      (is (nil? (:output/pending-stdout db)))
      (is (= [[:fx/append-stdout-with-images {:text "look: <<image-1 svg+xml 5 B>>\n"
                                              :images [{:image/n 1
                                                        :image/mime "image/svg+xml"
                                                        :image/subtype "svg+xml"
                                                        :image/size "5 B"
                                                        :image/data-url url
                                                        :image/line-index 0
                                                        :image/line-offset 6}]
                                              :raw (str "look: " url "\n")}
               "evalOut"]]
             fxs)))))

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
  (testing "stderr image refs and a data URL always get with-images, with :raw as printed"
    (doseq [output ["/tmp/no-such-image.png\n"
                    "https://raw.githubusercontent.com/BetterThanTomorrow/calva/dev/assets/calva.png\n"
                    "/tmp/calva-symbol.svg\n"
                    (str png-data-url "\n")]]
      (let [result (sut/handle-action sut/initial-db
                                      [:msg/output {:command/name "show-stdout"
                                                    :output output
                                                    :output-category "evalErr"}])
            [[op payload category]] (:uf/fxs result)]
        (is (= :fx/append-stdout-with-images op)
            (str "stderr image line uses with-images: " output))
        (is (= "evalErr" category))
        (is (= output (:raw payload))
            (str "raw form payload is exact printed text: " output))
        (is (seq (:images payload))))))
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
  (testing "stdout with a printed map of image paths stays whole-line only"
    (let [output (str (pr-str {:icon "calva-symbol.svg"}) "\n")
          result (sut/handle-action sut/initial-db [:msg/output {:command/name "show-stdout"
                                                                  :output output
                                                                  :output-category "evalOut"}])]
      (is (= [[:fx/append-stdout output "evalOut"]] (:uf/fxs result))))))
