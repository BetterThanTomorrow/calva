(ns calva.repl.webview.styles.errors
  "The styles of errors with their causes and frames.")

(def error
  "The error and its folding controls."
  [[:.output-error {:position :relative
                    :font-family "var(--vscode-editor-font-family, monospace)"
                    :font-size "calc(var(--vscode-editor-font-size, 12px) * var(--calva-output-font-scale, 1))"
                    :margin-block "4px"}
    ["button:where(:not(.output-copy-button))" {:display :flex
                                                :align-items :flex-start
                                                :gap "2px"
                                                :width "100%"
                                                :padding 0
                                                :border :none
                                                :background :transparent
                                                :color :inherit
                                                :font :inherit
                                                :text-align :start
                                                :cursor :pointer}]]

   [:.output-error-toggle :.output-error-cause-toggle {:display :flex
                                                       :align-items :flex-start
                                                       :gap "2px"
                                                       :cursor :pointer}]

   [:.output-error
    [:.output-error-chevron-button {:flex :none
                                    :width :auto}]]

   [:.output-error-frame-openable {:cursor :pointer}]

   [:.output-error
    ["button:where(:not(.output-copy-button)):focus-visible" {:outline [["1px" :solid "var(--vscode-focusBorder, #007fd4)"]]
                                                              :outline-offset "1px"}]]

   [:.output-error-chevron {:flex :none
                            :width "16px"
                            :height "1.4em"
                            :fill "var(--vscode-icon-foreground, #c5c5c5)"
                            :transition [[:transform "0.1s" :ease-out]]}]

   [:.output-error
    ["button[aria-expanded=\"true\"] > .output-error-chevron" {:transform "rotate(90deg)"}]]])

(def text
  "The error text and its causes."
  [[:.output-error-text {:margin 0
                         :white-space :pre-wrap
                         :overflow-wrap :anywhere
                         :font :inherit}]

   [".output-error[data-error-category=\"evalErr\"]"
    ".output-error[data-error-category=\"otherErr\"]"
    [:.output-error-text {:color "var(--vscode-errorForeground, #f48771)"}]]

   [".output-error[data-error-category=\"otherOut\"]"
    [:.output-error-text {:color "var(--vscode-descriptionForeground, #858585)"}]]

   [:.output-error-causes {:margin-inline-start "18px"
                           :padding-block [["2px" "6px"]]}]

   [:.output-error-cause {:margin-block-start "6px"}]

   [:.output-error-cause-heading {:overflow-wrap :anywhere}]

   [:.output-error-frame-count {:flex :none
                                :margin-inline-start "1ch"
                                :color "var(--vscode-descriptionForeground, #858585)"}]])

(def frames
  "The details and the frames of a cause."
  [[:.output-error-detail {:margin [["2px" 0 "2px" "18px"]]
                           :white-space :pre-wrap
                           :overflow-wrap :anywhere
                           :font :inherit
                           :color "var(--vscode-descriptionForeground, #858585)"}]

   [:.output-error-code {:padding 0
                         :background :none
                         :font :inherit}]

   [:.output-error-frames {:margin [["2px" 0 0 "18px"]]
                           :padding 0
                           :list-style :none}]

   [:.output-error-frame {:line-height 1.4}
    [:span {:overflow-wrap :anywhere}]]

   [:.output-error-frame-location {:display :inline-block
                                   :min-width "24ch"
                                   :margin-inline-end "1ch"
                                   :white-space :nowrap}]

   [:.output-error-frame-qualifier {:color "var(--vscode-descriptionForeground, #858585)"}]

   [:.output-error
    [:.output-error-frame-link {:display :inline
                                :width :auto
                                :color "var(--vscode-textLink-foreground, #3794ff)"}
     [:&:hover
      [:.output-error-frame-location {:text-decoration :underline}]]]]])

(def filters
  "The frame filters."
  [[:.output-error-filters {:display :flex
                            :flex-direction :column
                            :gap "4px"
                            :margin-block [["4px" "2px"]]
                            :font-family "var(--vscode-font-family, sans-serif)"
                            :font-size "calc(var(--vscode-font-size, 13px) * var(--calva-output-font-scale, 1))"}]

   [:.output-error-filter-row {:display :flex
                               :flex-wrap :wrap
                               :align-items :center
                               :gap [["2px" "4px"]]}]

   [:.output-error-switch {:display :inline-flex
                           :margin-inline-end "8px"
                           :border [["1px" :solid "var(--vscode-input-border, var(--vscode-widget-border, #454545))"]]
                           :border-radius "3px"}]

   [:.output-error-filter-label {:margin-inline-end "4px"
                                 :color "var(--vscode-descriptionForeground, #858585)"}]

   [:.output-error
    [:.output-error-filter {:display :inline-flex
                            :width :auto
                            :padding [["1px" "6px"]]
                            :border [["1px" :solid :transparent]]
                            :border-radius "3px"
                            :color "var(--vscode-foreground, #cccccc)"}]
    [:.output-error-switch
     [:.output-error-filter {:border-radius 0}]]
    [:.output-error-filter
     [:&:hover {:background-color "var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31))"}]
     ["&[aria-pressed=\"true\"]" {:background-color "var(--vscode-inputOption-activeBackground, rgba(0, 127, 212, 0.4))"
                                  :border-color "var(--vscode-inputOption-activeBorder, #007acc)"
                                  :color "var(--vscode-inputOption-activeForeground, #ffffff)"}]]]])

(def location
  "The hidden frames count and the compile location."
  [[:.output-error-hidden-count {:color "var(--vscode-descriptionForeground, #858585)"}]

   [:.output-error-location {:margin-block [["2px" "4px"]]}]

   [:.output-error
    [:.output-error-location-link {:display :inline
                                   :width :auto
                                   :margin-block [["2px" "4px"]]
                                   :color "var(--vscode-textLink-foreground, #3794ff)"}
     [:&:hover {:text-decoration :underline}]]]])
