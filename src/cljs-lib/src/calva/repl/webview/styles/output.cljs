(ns calva.repl.webview.styles.output
  "The styles of the page and of the output blocks that are text.")

(def page
  "The page, its fonts and its output."
  [[":root" {:--calva-output-font-scale 1}]

   [:body {:--calva-output-inset "20px"
           :padding-inline "var(--calva-output-inset)"}]

   ["pre[data-output-element-type]"
    ".evaluated-code-container pre"
    ".evaluated-code-container code"
    ".output-element-container > pre"
    ".output-element-container > pre > code"
    :.ns-info-container
    {:font-family "var(--vscode-editor-font-family, monospace)"
     :font-size "calc(var(--vscode-editor-font-size, 12px) * var(--calva-output-font-scale, 1))"}]

   [:.output-element-container {:padding-bottom "5px"}]])

(def text
  "Stdout and the wrapping of code."
  [["pre[data-output-element-type=\"stdout\"]"
    "pre[data-output-element-type=\"evalOut\"]"
    "pre[data-output-element-type=\"otherOut\"]"
    "pre[data-output-element-type=\"evalErr\"]"
    "pre[data-output-element-type=\"otherErr\"]"
    {:white-space :pre-wrap
     :overflow-wrap :anywhere}]

   ["pre[data-output-element-type=\"otherOut\"]"
    {:color "var(--vscode-descriptionForeground, #858585)"}]

   ["pre[data-output-element-type=\"evalErr\"]"
    "pre[data-output-element-type=\"otherErr\"]"
    {:color "var(--vscode-errorForeground, #f48771)"}]

   [:body.word-wrap
    [:code.hljs {:white-space :pre-wrap
                 :overflow-wrap :anywhere
                 :padding-left "calc(1em + 1.5ch)"
                 :text-indent "-1.5ch"}]]])

(def greeting
  "The greeting at the top of the view."
  [[:.output-greeting {:padding [["4px" 0 "20px"]]}
    [:a {:color "var(--vscode-textLink-foreground)"}]
    [:pre {:white-space :pre-wrap
           :overflow-wrap :anywhere}]
    [:img.calva-logo {:display :block
                      :width "120px"
                      :height :auto
                      :margin-top "8px"}]]])

(def evaluated-code
  "The evaluated code block, under its label."
  [[:.evaluated-code-container {:border :solid
                                :margin-top "30px"}]

   [:.border-text {:display :block
                   :float :left
                   :clear :left
                   :padding-left "10px"
                   :padding-right "10px"
                   :margin-top "-10px"
                   :margin-left "10px"
                   :background-color "var(--vscode-editor-background)"}]])

(def ns-info
  "The badges of who evaluated, in which session and namespace."
  [[:.ns-info-container {:display :flex
                         :align-items :center
                         :gap "4px"
                         :margin-top "14px"
                         :margin-bottom "2px"
                         :line-height 1.2}]

   [:.ns-info-prefix {:color "var(--vscode-editorLineNumber-foreground, #858585)"
                      :margin-right "2px"
                      :font-weight :bold}]

   [:.ns-info-badge {:padding [["1px" "6px"]]
                     :border-radius "2px"
                     :font-size "0.9em"
                     :white-space :nowrap
                     :border [["1px" :solid "var(--vscode-contrastBorder, transparent)"]]}]

   [:.ns-info-who {:background-color "#00bcd4"
                   :color "#000000"
                   :font-weight 500}]

   [:.ns-info-session {:background-color "var(--vscode-badge-background, #4d4d4d)"
                       :color "var(--vscode-badge-foreground, #ffffff)"}]

   [:.ns-info-ns {:background-color "var(--vscode-editor-foreground, #cccccc)"
                  :color "var(--vscode-editor-background, #1e1e1e)"
                  :font-weight 500}]])

(def tooltip
  "The tooltip of the controls."
  [["[interestfor]" {:interest-delay-start "500ms"
                     :interest-delay-end "100ms"}]

   [:.output-tooltip {:position-area :top
                      :position-try-fallbacks :bottom
                      :inset :auto
                      :width :max-content
                      :max-width "calc(100vw - 8px)"
                      :margin "4px"
                      :padding [["4px" "8px"]]
                      :box-sizing :border-box
                      :font-family "var(--vscode-font-family)"
                      :font-size "calc(0.9 * var(--vscode-font-size, 13px) * var(--calva-output-font-scale, 1))"
                      :line-height 1.4
                      :white-space :normal
                      :color "var(--vscode-editorHoverWidget-foreground)"
                      :background-color "var(--vscode-editorHoverWidget-background)"
                      :border [["1px" :solid "var(--vscode-editorHoverWidget-border)"]]
                      :border-radius "3px"
                      :box-shadow [[0 "2px" "8px" "var(--vscode-widget-shadow)"]]}]])
