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
  (testing "relative path keeps a trusted remote session project-root URI"
    (let [root (fake-uri "ssh-remote+host" "/home/user/proj")
          vscode (fake-vscode)
          prev @sut/!session-project-root-uri-fn]
      (try
        (sut/set-session-project-root-uri-fn! (fn [_] root))
        (let [uri (sut/file-uri-for-ref vscode "charts/a.png" "clj")]
          (is (some? uri))
          (is (= "ssh-remote+host" (.-authority ^js uri))))
        (finally
          (sut/set-session-project-root-uri-fn! prev)))))
  (testing "user-supplied file: and UNC paths with an authority stay refused"
    (is (nil? (sut/file-uri-for-ref (fake-vscode "server") "file://server/share/x.png")))
    (is (nil? (sut/file-uri-for-ref (fake-vscode) "\\\\server\\share\\x.png")))
    (is (nil? (sut/file-uri-for-ref (fake-vscode) "//server/share/x.png")))))

(deftest local-resource-roots-uses-non-file-workspace-folders-test
  (let [extension-uri (fake-uri "" "/ext")
        remote-folder (fake-uri "vscode-remote+host" "/home/user/proj")
        file-folder (fake-uri "" "/local/proj")
        vscode (fake-vscode)]
    (set! (.-workspace ^js vscode)
          #js {:workspaceFolders #js [#js {:uri remote-folder}
                                      #js {:uri file-folder}]})
    (with-redefs [util/vscode-context (atom #js {:extensionUri extension-uri})
                  util/vscode (atom vscode)
                  util/get-project-root-uri (fn
                                             ([] (throw (js/Error. "global getter must not be used")))
                                             ([_] (throw (js/Error. "global getter must not be used"))))]
      (let [roots (vec (sut/local-resource-roots))]
        (is (some #(= remote-folder %) roots)
            "non-file workspace folder is in localResourceRoots")
        (is (not-any? #(= file-folder %) roots)
            "file workspace folder is omitted")
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
                        (let [prev @sut/!session-project-root-uri-fn]
                          (try
                            (sut/set-session-project-root-uri-fn! (fn [_] root))
                            (with-redefs [util/vscode (atom vscode)]
                              (reset! posted nil)
                              (sut/handle-webview-message! host #js {:command "resolve-local-image"
                                                                     :id "remote-rel"
                                                                     :src "charts/a.png"
                                                                     :sessionKey "clj"}))
                            (finally
                              (sut/set-session-project-root-uri-fn! prev))))
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

(deftest file-uri-for-ref-allows-dotdot-under-remote-root-test
  (let [root (fake-uri "ssh-remote+host" "/home/user/proj")
        vscode (fake-vscode)
        prev @sut/!session-project-root-uri-fn]
    (try
      (sut/set-session-project-root-uri-fn! (fn [_] root))
      (testing "../ climbs out of the remote session root"
        (let [uri (sut/file-uri-for-ref vscode "../x.png" "clj")]
          (is (some? uri))
          (is (= "vscode-remote" (.-scheme ^js uri)))
          (is (= "ssh-remote+host" (.-authority ^js uri)))
          (is (= "/home/user/x.png" (.-path ^js uri)))))
      (testing "a path under the remote root is kept"
        (let [uri (sut/file-uri-for-ref vscode "charts/a.png" "clj")]
          (is (some? uri))
          (is (= "vscode-remote" (.-scheme ^js uri)))
          (is (= "ssh-remote+host" (.-authority ^js uri)))
          (is (= "/home/user/proj/charts/a.png" (.-path ^js uri)))))
      (finally
        (sut/set-session-project-root-uri-fn! prev)))))

(deftest resolve-local-image-second-remote-session-loads-test
  (async done
         (let [posted (atom nil)
               root-file (fake-uri "" "/proj-a")
               root-remote (fake-uri "vscode-remote+host" "/home/user/other")
               host #js {:webview #js {:asWebviewUri (fn [uri]
                                                      (str "webview:"
                                                           (.-authority ^js uri)
                                                           (.-fsPath ^js uri)))
                                       :postMessage (fn [s] (reset! posted s))}}
               vscode (let [base (fake-vscode)]
                        (set! (.-workspace ^js base)
                              #js {:workspaceFolders #js [#js {:uri root-file}
                                                          #js {:uri root-remote}]
                                   :fs #js {:stat (fn [uri]
                                                    (if (= "vscode-remote+host"
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
                        (let [prev @sut/!session-project-root-uri-fn]
                          (try
                            (sut/set-session-project-root-uri-fn!
                             (fn [session-key]
                               (case session-key
                                 "clj" root-file
                                 "cljs" root-remote
                                 nil)))
                            (with-redefs [util/vscode-context (atom #js {:extensionUri (fake-uri "" "/ext")})
                                          util/vscode (atom vscode)
                                          util/get-project-root-uri (fn
                                                                     ([] (throw (js/Error. "unused")))
                                                                     ([_] (throw (js/Error. "unused"))))]
                              (let [roots (vec (sut/local-resource-roots))]
                                (is (some #(= root-remote %) roots)
                                    "second session remote workspace folder is allow-listed")
                                (is (not-any? #(= root-file %) roots)
                                    "file session folder is omitted from roots"))
                              (reset! posted nil)
                              (sut/handle-webview-message! host #js {:command "resolve-local-image"
                                                                     :id "second-remote"
                                                                     :src "charts/a.png"
                                                                     :sessionKey "cljs"}))
                            (finally
                              (sut/set-session-project-root-uri-fn! prev))))
                        (js/Promise.
                         (fn [resolve]
                           (js/setTimeout
                            (fn []
                              (is (str/includes? (str @posted) "local-image-resolved")
                                  "second session remote relative path loads")
                              (is (str/includes? (str @posted) "vscode-remote+host")
                                  "resolved URI keeps the remote session authority")
                              (resolve nil))
                            20)))))
               (.then (fn [_] (finish!)))
               (.catch (fn [e]
                         (is false (str e))
                         (finish!)))))))

(deftest apply-local-resource-roots-tracks-workspace-folder-changes-test
  (let [extension-uri (fake-uri "" "/ext")
        remote-a (fake-uri "vscode-remote+a" "/home/a")
        remote-b (fake-uri "vscode-remote+b" "/home/b")
        vscode (fake-vscode)
        options #js {:enableScripts true
                     :enableCommandUris #js ["calva.showReplOutputView"]
                     :localResourceRoots #js [extension-uri]}
        host #js {:webview #js {:options options}}
        set-folders! (fn [uris]
                       (set! (.-workspace ^js vscode)
                             #js {:workspaceFolders
                                  (to-array (map (fn [uri] #js {:uri uri}) uris))}))
        remote-roots (fn []
                       (->> (array-seq (.. ^js host -webview -options -localResourceRoots))
                            (filter #(not= "file" (.-scheme ^js %)))
                            vec))
        remote-count (fn []
                       (count (filter #(not= extension-uri %)
                                      (remote-roots))))]
    (with-redefs [util/vscode-context (atom #js {:extensionUri extension-uri})
                  util/vscode (atom vscode)]
      (testing "adding a workspace folder updates the roots"
        (set-folders! [remote-a])
        (sut/apply-local-resource-roots! host)
        (is (some #(= remote-a %) (remote-roots)))
        (is (= 1 (remote-count)))
        (set-folders! [remote-a remote-b])
        (sut/apply-local-resource-roots! host)
        (is (some #(= remote-a %) (remote-roots)))
        (is (some #(= remote-b %) (remote-roots)))
        (is (= 2 (remote-count))))
      (testing "removing a workspace folder updates the roots"
        (set-folders! [remote-b])
        (sut/apply-local-resource-roots! host)
        (is (not-any? #(= remote-a %) (remote-roots)))
        (is (some #(= remote-b %) (remote-roots)))
        (is (= 1 (remote-count))))
      (testing "repeated changes keep the list the size of the current folders"
        (dotimes [_ 8]
          (set-folders! [remote-a remote-b])
          (sut/apply-local-resource-roots! host)
          (is (= 2 (remote-count))
              "two remote folders stay two remote roots")
          (set-folders! [remote-a])
          (sut/apply-local-resource-roots! host)
          (is (= 1 (remote-count))
              "one remote folder stays one remote root"))
        (is (= 1 (remote-count)))
        (is (some #(= remote-a %) (remote-roots)))
        (is (not-any? #(= remote-b %) (remote-roots)))))))

(deftest listen-for-workspace-folder-changes-disposes-test
  (let [extension-uri (fake-uri "" "/ext")
        remote-a (fake-uri "vscode-remote+a" "/home/a")
        remote-b (fake-uri "vscode-remote+b" "/home/b")
        !handler (atom nil)
        !disposed (atom false)
        vscode (fake-vscode)
        options #js {:enableScripts true
                     :localResourceRoots #js [extension-uri]}
        host #js {:webview #js {:options options}}]
    (set! (.-workspace ^js vscode)
          #js {:workspaceFolders #js [#js {:uri remote-a}]
               :onDidChangeWorkspaceFolders
               (fn [handler]
                 (reset! !handler handler)
                 #js {:dispose (fn [] (reset! !disposed true))})})
    (with-redefs [util/vscode-context (atom #js {:extensionUri extension-uri})
                  util/vscode (atom vscode)]
      (let [disposable (sut/listen-for-workspace-folder-changes! host)]
        (is (some? @!handler))
        (is (some? disposable))
        (set! (.-workspaceFolders ^js (.-workspace vscode))
              #js [#js {:uri remote-a}
                   #js {:uri remote-b}])
        (@!handler #js {})
        (let [roots (vec (array-seq (.. ^js host -webview -options -localResourceRoots)))]
          (is (some #(= remote-b %) roots)
              "listener rebuild replaces roots from current folders"))
        (.dispose ^js disposable)
        (is (true? @!disposed)
            "dispose tears down the workspaceFolders listener")))))
