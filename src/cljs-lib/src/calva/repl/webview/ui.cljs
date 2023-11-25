(ns calva.repl.webview.ui
  (:require [reagent.dom :as rdom]
            [reagent.core :as r]))

(defonce output-elements
  (r/atom [{:output-element/type :output-element.type/eval-result
            :output-element/content "{:a 1}"}
           {:output-element/type :output-element.type/stdout
            :output-element/content "Hello world"}]))

(defn add-eval-result
  [content]
  (swap! output-elements
         conj
         {:output-element/type :output-element.type/eval-result
          :output-element/content content}))

(defn add-stdout
  [content]
  (swap! output-elements
         conj
         {:output-element/type :output-element.type/stdout
          :output-element/content content}))

(defn repl-output []
  (let [elements @output-elements]
    [:div
     (for [{:output-element/keys [content]} elements]
       [:p content])]))

(defn main []
  (.. js/window
      (addEventListener "message"
                        (fn [^js message]
                          (let [command (.. message -command)
                                data (.. message -data)]
                            (case command
                              "show-result" (add-eval-result data)
                              "show-stdout" (add-stdout data))))))
  (rdom/render [repl-output] (js/document.getElementById "output")))

(comment

  (reset! output-elements [])

  @output-elements

  ;; For some reason this is not causing the UI to update...
  ;; Reason: It was because I was connected to the calva-lib (node) build and not the repl-output-ui (browser) build
  (swap! output-elements conj {:output-element/type :output-element.type/eval-result
                               :output-element/content "{:a 1}"})

  :rcf)
