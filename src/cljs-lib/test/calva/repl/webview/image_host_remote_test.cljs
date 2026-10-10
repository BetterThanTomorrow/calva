(ns calva.repl.webview.image-host-remote-test
  (:require
   [calva.repl.webview.image-host :as sut]
   [calva.util :as util]
   [cljs.test :refer-macros [deftest testing is async]]
   [clojure.string :as str]))

(defn- fake-uri
  ([authority]
   (fake-uri authority nil))
  ([authority path]
   #js {:scheme (if (str/blank? (str authority)) "file" "vscode-remote")
        :authority (or authority "")
        :path (or path "")
        :fsPath (or path "")
        :toString (fn [] (str "uri:" (or path authority)))}))

(defn- fake-vscode
  ([]
   (fake-vscode nil))
  ([authority-for-parse]
   (let [uri-api #js {:parse (fn [src]
                               (when (str/starts-with? src "file:////")
                                 (throw (js/Error. "path cannot begin with two slash characters")))
                               (fake-uri authority-for-parse src))
                      :file (fn [src]
                              (if (or (str/starts-with? src "//")
                                      (str/starts-with? src "\\\\"))
                                (fake-uri "server" src)
                                (fake-uri "" src)))
                      :joinPath (fn [uri & parts]
                                  (let [base (vec (remove str/blank?
                                                          (str/split (str (.-path uri)) #"/")))
                                        segs (reduce (fn [acc part]
                                                       (cond
                                                         (or (str/blank? part) (= "." part)) acc
                                                         (= ".." part) (if (seq acc) (pop acc) acc)
                                                         :else (conj acc part)))
                                                     base
                                                     parts)
                                        new-path (str "/" (str/join "/" segs))]
                                    #js {:scheme (.-scheme uri)
                                         :authority (.-authority uri)
                                         :path new-path
                                         :fsPath new-path
                                         :toString (fn [] (str "uri:" new-path))}))}]
     #js {:Uri uri-api})))

(deftest file-uri-for-ref-remote-project-root-test
  (testing "relative path keeps a trusted remote project-root URI"
    (let [root (fake-uri "ssh-remote+host" "/home/user/proj")
          vscode (fake-vscode)]
      (with-redefs [util/get-project-root-uri (fn
                                                ([] root)
                                                ([_] root))]
        (let [uri (sut/file-uri-for-ref vscode "charts/a.png")]
          (is (some? uri))
          (is (= "ssh-remote+host" (.-authority ^js uri)))))))
  (testing "user-supplied file: and UNC paths with an authority stay refused"
    (is (nil? (sut/file-uri-for-ref (fake-vscode "server") "file://server/share/x.png")))
    (is (nil? (sut/file-uri-for-ref (fake-vscode) "\\\\server\\share\\x.png")))
    (is (nil? (sut/file-uri-for-ref (fake-vscode) "//server/share/x.png")))))

(deftest local-resource-roots-includes-project-root-test
  (let [extension-uri (fake-uri "" "/ext")
        project-root (fake-uri "ssh-remote+host" "/home/user/proj")
        vscode (fake-vscode)]
    (with-redefs [util/vscode-context (atom #js {:extensionUri extension-uri})
                  util/vscode (atom vscode)
                  util/get-project-root-uri (fn
                                             ([] project-root)
                                             ([_] project-root))]
      (let [roots (vec (sut/local-resource-roots))]
        (is (some #(= project-root %) roots)
            "project root is in localResourceRoots")
        (is (some #(= extension-uri %) roots)
            "extension URI stays in localResourceRoots")))))

(deftest resolve-local-image-remote-relative-test
  (async done
         (let [posted (atom nil)
               root (fake-uri "ssh-remote+host" "/home/user/proj")
               host #js {:webview #js {:asWebviewUri (fn [uri]
                                                      (str "webview:"
                                                           (.-authority ^js uri)
                                                           (.-fsPath ^js uri)))
                                       :postMessage (fn [s] (reset! posted s))}}
               vscode (let [base (fake-vscode)]
                        (set! (.-workspace ^js base)
                              #js {:fs #js {:stat (fn [uri]
                                                    (if (= "ssh-remote+host"
                                                           (str (.-authority ^js uri)))
                                                      (js/Promise.resolve #js {})
                                                      (js/Promise.reject (js/Error. "missing"))))}})
                        base)
               !settled (atom false)
               finish! (fn []
                         (when (compare-and-set! !settled false true)
                           (done)))]
           (-> (js/Promise.resolve nil)
               (.then (fn []
                        (with-redefs [util/vscode (atom vscode)
                                      util/get-project-root-uri (fn
                                                                  ([] root)
                                                                  ([_] root))]
                          (reset! posted nil)
                          (sut/handle-webview-message! host #js {:command "resolve-local-image"
                                                                 :id "remote-rel"
                                                                 :src "charts/a.png"}))
                        (js/Promise.
                         (fn [resolve]
                           (js/setTimeout
                            (fn []
                              (is (str/includes? (str @posted) "local-image-resolved")
                                  "remote-scheme relative path resolves")
                              (resolve nil))
                            20)))))
               (.then (fn [_] (finish!)))
               (.catch (fn [e]
                         (is false (str e))
                         (finish!)))))))

(deftest file-uri-for-ref-rejects-dotdot-under-remote-root-test
  (let [root (fake-uri "ssh-remote+host" "/home/user/proj")
        vscode (fake-vscode)]
    (with-redefs [util/get-project-root-uri (fn
                                              ([] root)
                                              ([_] root))]
      (testing "../ escapes are refused"
        (is (nil? (sut/file-uri-for-ref vscode "../x.png")))
        (is (nil? (sut/file-uri-for-ref vscode "a/../../x.png")))
        (is (nil? (sut/file-uri-for-ref vscode "..\\x.png"))))
      (testing "a path under the remote root is kept"
        (let [uri (sut/file-uri-for-ref vscode "charts/a.png")]
          (is (some? uri))
          (is (= "vscode-remote" (.-scheme ^js uri)))
          (is (= "ssh-remote+host" (.-authority ^js uri)))
          (is (= "/home/user/proj/charts/a.png" (.-path ^js uri))))))))
