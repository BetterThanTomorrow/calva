(ns calva.docs.url-test
  (:require [calva.docs.url :as url]
            [clojure.test :refer [deftest is testing]]))

(deftest page-url
  (is (= "" (url/page-url "index.md")))
  (is (= "api/" (url/page-url "api.md"))))

(deftest site-root
  (is (= "." (url/site-root "")))
  (is (= ".." (url/site-root "api/")))
  (is (= "/" (url/site-root "/"))))

(deftest site-href
  (is (= "./" (url/site-href "" "")))
  (is (= "../" (url/site-href "api/" "")))
  (is (= "../img/favicon.ico" (url/site-href "api/" "img/favicon.ico")))
  (testing "the page at / is served at any path, so it links from the site root"
    (is (= "/" (url/site-href "/" "")))
    (is (= "/img/favicon.ico" (url/site-href "/" "img/favicon.ico")))))

(deftest content-href
  (testing "links to pages point at their directory URLs"
    (is (= "joyride/" (url/content-href "" "joyride.md")))
    (is (= "../joyride/#setup" (url/content-href "api/" "joyride.md#setup")))
    (is (= "../joyride/" (url/content-href "api/" "./joyride.md")))
    (is (= "../" (url/content-href "api/" "index.md"))))
  (testing "other relative hrefs are relative to the page"
    (is (= "../images/a.png" (url/content-href "api/" "images/a.png"))))
  (testing "anchors, absolute paths and URLs are unchanged"
    (doseq [href ["#local" "/abs" "https://example.org/a.md" "mailto:a@b.c" ""]]
      (is (= href (url/content-href "api/" href))))))

(deftest social-card-path
  (is (= "assets/images/social/index.png" (url/social-card-path "index.md")))
  (is (= "assets/images/social/api.png" (url/social-card-path "api.md"))))
