(ns calva.util-test
  (:require
   [calva.util :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(deftest get-first-workspace-folder-uri-test
  (testing "nil vscode"
    (with-redefs [sut/vscode (atom nil)]
      (is (nil? (sut/get-first-workspace-folder-uri)))))
  (testing "vscode without a workspace object"
    (with-redefs [sut/vscode (atom #js {})]
      (is (nil? (sut/get-first-workspace-folder-uri)))))
  (testing "workspaceFolders undefined"
    (with-redefs [sut/vscode (atom #js {:workspace #js {}})]
      (is (nil? (sut/get-first-workspace-folder-uri)))))
  (testing "empty workspaceFolders"
    (with-redefs [sut/vscode (atom #js {:workspace #js {:workspaceFolders #js []}})]
      (is (nil? (sut/get-first-workspace-folder-uri)))))
  (testing "first folder uri"
    (let [folder-uri #js {:path "/proj"}]
      (with-redefs [sut/vscode (atom #js {:workspace #js {:workspaceFolders #js [#js {:uri folder-uri}]}})]
        (is (= folder-uri (sut/get-first-workspace-folder-uri)))))))
