(ns calva.repl.webview.images-test
  (:require
   [calva.repl.webview.images :as sut]
   [cljs.test :refer-macros [deftest testing is]]
   [clojure.string :as str]))

(def png-base64 "iVBORw0KGgo=")
(def png-data-url (str "data:image/png;base64," png-base64))

(deftest decoded-byte-count-test
  (testing "counts decoded bytes, accounting for padding"
    (is (= 3 (sut/decoded-byte-count "aGVs")))
    (is (= 2 (sut/decoded-byte-count "aGU=")))
    (is (= 1 (sut/decoded-byte-count "aA=="))))

  (testing "ignores whitespace"
    (is (= 3 (sut/decoded-byte-count "aG\n Vs")))))

(deftest format-byte-size-test
  (is (= "0 B" (sut/format-byte-size 0)))
  (is (= "999 B" (sut/format-byte-size 999)))
  (is (= "1 kB" (sut/format-byte-size 1000)))
  (is (= "12 kB" (sut/format-byte-size 12345)))
  (is (= "999 kB" (sut/format-byte-size 999499)))
  (is (= "1 MB" (sut/format-byte-size 999500)))
  (is (= "3 MB" (sut/format-byte-size 2500000))))

(deftest extract-images-test
  (testing "text without images is returned unchanged with no images"
    (is (= {:text "(+ 1 2)" :images []} (sut/extract-images "(+ 1 2)"))))

  (testing "a non-image data URL is left alone"
    (is (= {:text "\"data:text/plain;base64,aGk=\"" :images []}
           (sut/extract-images "\"data:text/plain;base64,aGk=\""))))

  (testing "an image data URL is replaced with a placeholder and returned as an image"
    (let [{:keys [text images]} (sut/extract-images (str "\"" png-data-url "\""))]
      (is (= "\"<<image-1 png 8 B>>\"" text))
      (is (= [{:image/n 1
               :image/mime "image/png"
               :image/subtype "png"
               :image/size "8 B"
               :image/data-url png-data-url
               :image/line-index 0
               :image/line-offset 1}]
             images))))

  (testing "several images are numbered from 1 in order"
    (let [{:keys [text images]} (sut/extract-images
                                 (str "[\"" png-data-url "\" \"data:image/svg+xml;base64,PHN2Zz4=\"]"))]
      (is (= "[\"<<image-1 png 8 B>>\" \"<<image-2 svg+xml 5 B>>\"]" text))
      (is (= [1 2] (map :image/n images)))
      (is (= ["png" "svg+xml"] (map :image/subtype images)))))

  (testing "trailing whitespace is kept after the placeholder"
    (is (= "<<image-1 png 8 B>>\n" (:text (sut/extract-images (str png-data-url "\n"))))))

  (testing "76-column wrapped base64 is one image, with the line breaks removed from the data URL"
    (let [line (apply str (repeat 76 "A"))
          {:keys [text images]} (sut/extract-images
                                 (str "data:image/png;base64," line "\n" line "\r\n" line "\nAAAA\nnext line"))]
      (is (= "<<image-1 png 174 B>>\nnext line" text))
      (is (= (str "data:image/png;base64," line line line "AAAA") (:image/data-url (first images))))))

  (testing "a full-width last line swallows a next line that starts like base64 (known heuristic limit)"
    (let [line (apply str (repeat 76 "A"))
          {:keys [text images]} (sut/extract-images (str "data:image/png;base64," line "\n" line "\ndone"))]
      (is (= "<<image-1 png 117 B>>" text))
      (is (str/ends-with? (:image/data-url (first images)) "AAAAdone"))))

  (testing "a line break after a line that is not a wrap width ends the image"
    (is (= "<<image-1 png 6 B>>\ndone" (:text (sut/extract-images "data:image/png;base64,iVBORw0K\ndone")))))

  (testing "two images on one line separated by prose"
    (let [{:keys [text images]} (sut/extract-images
                                 (str png-data-url " and data:image/gif;base64,AA=="))]
      (is (= "<<image-1 png 8 B>> and <<image-2 gif 1 B>>" text))
      (is (= [png-data-url "data:image/gif;base64,AA=="] (map :image/data-url images)))))

  (testing "the image ends at the first space before prose"
    (is (= "<<image-1 png 8 B>> is a tiny png" (:text (sut/extract-images (str png-data-url " is a tiny png"))))))

  (testing "the image ends right after = padding"
    (is (= "<<image-1 png 2 B>>AAAA" (:text (sut/extract-images "data:image/png;base64,AAA=AAAA"))))
    (is (= "<<image-1 png 1 B>>more" (:text (sut/extract-images "data:image/png;base64,AA==more")))))

  (testing "a data URL with no payload is left alone"
    (is (= {:text "data:image/png;base64, AAAA" :images []}
           (sut/extract-images "data:image/png;base64, AAAA"))))

  (testing "a whole-line https image URL is kept in the text and returned as a remote image"
    (let [url "https://example.com/cat.png"
          {:keys [text images]} (sut/extract-images (str "\"" url "\"\n"))]
      (is (= (str "\"" url "\"\n") text))
      (is (= :remote (:image/kind (first images))))
      (is (= url (:image/src (first images))))))

  (testing "a whole-line file path is returned as a local image"
    (let [{:keys [text images]} (sut/extract-images "/tmp/cat.png\n")]
      (is (= "/tmp/cat.png\n" text))
      (is (= :local (:image/kind (first images))))))

  (testing "a URL mention inside a longer line is left alone"
    (is (= {:text "look: https://example.com/cat.png\n" :images []}
           (sut/extract-images "look: https://example.com/cat.png\n")))))

(deftest image-subtype-test
  (testing "a bare data:image/ mention followed later by ;base64, is left alone"
    (let [text "\"data:image/png\" foo bar;base64,AAAA"]
      (is (= {:text text :images []} (sut/extract-images text)))))

  (testing "2 MB of URL-encoded SVG data URLs is left alone, fast"
    (let [svg (str "data:image/svg+xml,%3Csvg%3E" (apply str (repeat 90 "%3Cpath/%3E")) "%3C/svg%3E")
          text (apply str (repeat 2000 (str "[:img {:src \"" svg "\"}]\n")))
          started (js/Date.now)]
      (is (= {:text text :images []} (sut/extract-images text)))
      (is (< (- (js/Date.now) started) 5000)))))

(deftest image-mime-parameters-test
  (testing "detected with a MIME type that has no parameters"
    (let [{:keys [text images]} (sut/extract-images png-data-url)
          image (first images)]
      (is (= "<<image-1 png 8 B>>" text))
      (is (= "image/png" (:image/mime image)))
      (is (= png-data-url (:image/data-url image)))))

  (testing "a data URL with charset is detected with a bare mime and a working data URL"
    (let [url "data:image/svg+xml;charset=utf-8;base64,PHN2Zz4="
          {:keys [text images]} (sut/extract-images url)
          image (first images)]
      (is (= "<<image-1 svg+xml 5 B>>" text))
      (is (= "image/svg+xml" (:image/mime image)))
      (is (= "svg+xml" (:image/subtype image)))
      (is (= url (:image/data-url image)))))

  (testing "several MIME parameters before base64 are accepted"
    (let [url "data:image/png;foo=bar;baz=qux;base64,iVBORw0KGgo="
          {:keys [text images]} (sut/extract-images url)]
      (is (= "<<image-1 png 8 B>>" text))
      (is (= "image/png" (:image/mime (first images))))
      (is (= url (:image/data-url (first images))))))

  (testing "prose with a semicolon then a later ;base64, does not span a match"
    (let [text "\"data:image/png\" foo; bar;base64,AAAA"]
      (is (= {:text text :images []} (sut/extract-images text)))))

  (testing "prose that starts right after the image type is not a match"
    (doseq [text ["data:image/png; see note; then ;base64,AAAA"
                  "data:image/png;x=1 and prose;base64,AAAA"]]
      (is (= {:text text :images []} (sut/extract-images text))))))

(deftest pending-start-test
  (testing "text without a data URL has nothing pending"
    (is (nil? (sut/pending-start "hello\n"))))

  (testing "a data URL whose payload runs to the end is pending from its start"
    (is (= 2 (sut/pending-start "x data:image/png;base64,AAAA")))
    (is (= 0 (sut/pending-start "data:image/png;base64,AAA="))))

  (testing "a data URL ended by padding, or by prose, has nothing pending"
    (is (nil? (sut/pending-start "data:image/png;base64,AA==")))
    (is (nil? (sut/pending-start (str png-data-url " done")))))

  (testing "a full-width wrapped line ending in a line break is pending"
    (is (= 0 (sut/pending-start (str "data:image/png;base64," (apply str (repeat 76 "A")) "\n")))))

  (testing "a trailing beginning of a data URL header is pending"
    (is (= 5 (sut/pending-start "text data:image/pn")))
    (is (= 5 (sut/pending-start "text data:image/png;base64,")))
    (is (= 4 (sut/pending-start "end d")))))

(deftest pending-start-mime-parameters-test
  (testing "a trailing parameterised header is pending"
    (is (= 5 (sut/pending-start "text data:image/svg+xml;charset=utf-8;base64,")))
    (is (= 0 (sut/pending-start "data:image/svg+xml;char")))
    (is (= 2 (sut/pending-start "x data:image/png;foo=bar"))))

  (testing "a cut inside a later parameter is held back from the start of the header"
    (is (= 0 (sut/pending-start "data:image/png;a=b;c="))))

  (testing "a parameterised header with an open payload is pending from its start"
    (is (= 0 (sut/pending-start "data:image/svg+xml;charset=utf-8;base64,AAAA")))))

(deftest label-and-placeholder-test
  (let [image {:image/n 2 :image/subtype "jpeg" :image/size "12 kB"}]
    (is (= "image-2 jpeg 12 kB" (sut/label image)))
    (is (= "<<image-2 jpeg 12 kB>>" (sut/placeholder image)))))

(def png-image-1 {:image/n 1 :image/subtype "png" :image/size "8 B"})
(def png-image-2 {:image/n 2 :image/subtype "png" :image/size "8 B"})

(deftest segments-with-images-test
  (testing "a nested map puts each image after the line that holds its placeholder"
    (let [line1 (str "{:a {:i1 " (pr-str (sut/placeholder png-image-1)) "\n")
          line2 (str "     :i2 " (pr-str (sut/placeholder png-image-2)) "}}")
          text (str line1 line2)]
      (is (= [{:text line1 :images [png-image-1]}
              {:text line2 :images [png-image-2]}]
             (sut/segments-with-images text [png-image-1 png-image-2])))))

  (testing "two placeholders on one line keep both images after that line, in order"
    (let [text (str (sut/placeholder png-image-1) " " (sut/placeholder png-image-2))]
      (is (= [{:text text :images [png-image-1 png-image-2]}]
             (sut/segments-with-images text [png-image-1 png-image-2])))))

  (testing "lines after the last placeholder stay as a text-only tail"
    (let [text (str "head\n" (sut/placeholder png-image-1) "\ntail\n")]
      (is (= [{:text (str "head\n" (sut/placeholder png-image-1) "\n") :images [png-image-1]}
              {:text "tail\n" :images []}]
             (sut/segments-with-images text [png-image-1])))))

  (testing "an image missing from the text is still appended at the end"
    (is (= [{:text (sut/placeholder png-image-1) :images [png-image-1]}
            {:text "" :images [png-image-2]}]
           (sut/segments-with-images (sut/placeholder png-image-1) [png-image-1 png-image-2]))))

  (testing "U+2028 and U+2029 stay in the joined segment text"
    (let [text (str "abc\u2028def\u2029ghi\n" (sut/placeholder png-image-1) "\n")]
      (is (= text (apply str (map :text (sut/segments-with-images text [png-image-1])))))))

  (testing "the same URL on two lines places one thumbnail per line by line-index"
    (let [img0 {:image/n 1 :image/kind :local :image/src "/tmp/a.png"
                :image/source "/tmp/a.png" :image/line-index 0
                :image/subtype "png" :image/mime "image/png"}
          img1 {:image/n 2 :image/kind :local :image/src "/tmp/a.png"
                :image/source "/tmp/a.png" :image/line-index 1
                :image/subtype "png" :image/mime "image/png"}
          text "/tmp/a.png\n/tmp/a.png\n"]
      (is (= [{:text "/tmp/a.png\n" :images [img0]}
              {:text "/tmp/a.png\n" :images [img1]}]
             (sut/segments-with-images text [img0 img1])))))

  (testing "a mention line after a real path line does not steal the thumbnail"
    (let [img {:image/n 1 :image/kind :local :image/src "a.png"
               :image/source "a.png" :image/line-index 0
               :image/subtype "png" :image/mime "image/png"}
          text "a.png\nsaved data.png and more\n"]
      (is (= [{:text "a.png\n" :images [img]}
              {:text "saved data.png and more\n" :images []}]
             (sut/segments-with-images text [img])))))

  (testing "a mention line before the real path places the thumbnail once, with that line"
    (let [img {:image/n 1 :image/kind :local :image/src "/tmp/a.png"
               :image/source "/tmp/a.png" :image/line-index 1
               :image/subtype "png" :image/mime "image/png"}
          text "look: /tmp/a.png\n/tmp/a.png\n"]
      (is (= [{:text "look: /tmp/a.png\n/tmp/a.png\n" :images [img]}]
             (sut/segments-with-images text [img])))))

  (testing "a Windows printed-string path sits under its own line"
    (let [printed (pr-str "C:\\Users\\pez\\a.png")
          img {:image/n 1 :image/kind :local :image/src "C:\\Users\\pez\\a.png"
               :image/source "C:\\Users\\pez\\a.png" :image/line-index 0
               :image/subtype "png" :image/mime "image/png"}
          text (str printed "\n")]
      (is (= [{:text text :images [img]}]
             (sut/segments-with-images text [img]))))))

(deftest segments-with-images-order-and-cost-test
  (testing "data URLs and paths on one line keep printed order"
    (let [d1 "data:image/png;base64,iVBORw0KGgo="
          d2 "data:image/png;base64,AAAA"
          {:keys [text images]} (sut/extract-images (pr-str [d1 "a.png" d2 "b.png"]) {:refs :result})
          row-srcs (mapv #(or (:image/src %) (sut/placeholder %))
                         (:images (first (sut/segments-with-images text images))))]
      (is (= [(sut/placeholder (first images)) "a.png"
              (sut/placeholder (second images)) "b.png"]
             row-srcs))))

  (testing "a map with a data URL and a path keeps printed order"
    (let [d "data:image/png;base64,iVBORw0KGgo="
          {:keys [text images]} (sut/extract-images (pr-str {:a d :b "b.png"}) {:refs :result})
          row-srcs (mapv #(or (:image/src %) (sut/placeholder %))
                         (:images (first (sut/segments-with-images text images))))]
      (is (= [(sut/placeholder (first images)) "b.png"] row-srcs))))

  (testing "duplicate paths on one line keep printed order around a data URL"
    (let [d1 "data:image/png;base64,iVBORw0KGgo="
          {:keys [text images]} (sut/extract-images (pr-str ["a.png" d1 "a.png"]) {:refs :result})
          row-srcs (mapv #(or (:image/src %) (sut/placeholder %))
                         (:images (first (sut/segments-with-images text images))))]
      (is (= ["a.png" (sut/placeholder (first images)) "a.png"] row-srcs))))

  (testing "a path that is a substring of an earlier path keeps printed order"
    (let [d1 "data:image/png;base64,iVBORw0KGgo="
          {:keys [text images]} (sut/extract-images (pr-str [{:note "x/b.png"} d1 "b.png"]) {:refs :result})
          row-srcs (mapv #(or (:image/src %) (sut/placeholder %))
                         (:images (first (sut/segments-with-images text images))))]
      (is (= ["x/b.png" (sut/placeholder (first images)) "b.png"] row-srcs))))

  (testing "splitting many pretty-printed lines stays fast with many images"
    (let [n 3000
          text (str/join "\n" (map #(str "\"p" % ".png\"") (range n)))
          imgs (mapv (fn [i]
                       {:image/n (inc i)
                        :image/kind :local
                        :image/src (str "p" i ".png")
                        :image/source (str "p" i ".png")
                        :image/line-index i
                        :image/subtype "png"
                        :image/mime "image/png"})
                     (range n))
          t0 (.now js/Date)
          segs (sut/segments-with-images text imgs)
          elapsed (- (.now js/Date) t0)]
      (is (= n (count segs)))
      (is (= n (count (mapcat :images segs))))
      (is (< elapsed 1000)
          (str "expected under 1000ms, took " elapsed "ms")))))

(deftest result-extract-images-test
  (testing "result refs find every matching printed string inside a map"
    (let [text (pr-str {:icon "calva-symbol.svg" :logo "https://example.com/x.png"})
          {:keys [images]} (sut/extract-images text {:refs :result})]
      (is (= ["calva-symbol.svg" "https://example.com/x.png"] (mapv :image/src images)))
      (is (= [1 2] (mapv :image/n images)))))
  (testing "default extract-images stays whole-line for stdout-shaped text"
    (let [text (pr-str {:icon "calva-symbol.svg"})]
      (is (= {:text text :images []} (sut/extract-images text))))))
