(ns calva.repl.webview.images-test
  (:require
   [calva.repl.webview.images :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

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

  (testing "whitespace inside the base64 is removed from the data URL and trailing whitespace is kept"
    (let [{:keys [text images]} (sut/extract-images "data:image/png;base64,iVBO\n Rw0KGgo=\n")]
      (is (= "<<image-1 png 8 B>>\n" text))
      (is (= png-data-url (:image/data-url (first images)))))))

(deftest label-and-placeholder-test
  (let [image {:image/n 2 :image/subtype "jpeg" :image/size "12 kB"}]
    (is (= "image-2 jpeg 12 kB" (sut/label image)))
    (is (= "<<image-2 jpeg 12 kB>>" (sut/placeholder image)))))
