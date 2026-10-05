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
               :image/data-url png-data-url}]
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
           (sut/extract-images "data:image/png;base64, AAAA")))))

(deftest image-subtype-test
  (testing "a bare data:image/ mention followed later by ;base64, is left alone"
    (let [text "\"data:image/png\" foo bar;base64,AAAA"]
      (is (= {:text text :images []} (sut/extract-images text)))))

  (testing "2 MB of URL-encoded SVG data URLs is left alone, fast"
    (let [svg (str "data:image/svg+xml,%3Csvg%3E" (apply str (repeat 90 "%3Cpath/%3E")) "%3C/svg%3E")
          text (apply str (repeat 2000 (str "[:img {:src \"" svg "\"}]\n")))
          started (js/Date.now)]
      (is (= {:text text :images []} (sut/extract-images text)))
      (is (< (- (js/Date.now) started) 1000)))))

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
           (sut/segments-with-images (sut/placeholder png-image-1) [png-image-1 png-image-2])))))
