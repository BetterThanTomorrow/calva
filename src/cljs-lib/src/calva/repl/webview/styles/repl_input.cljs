(ns calva.repl.webview.styles.repl-input
  "The styles of the REPL Input around its code editor.")

(def layout
  "The REPL Input at the bottom of the page, with its sash."
  [[:body.repl-input-on {:display :flex
                         :flex-direction :column
                         :box-sizing :border-box
                         :min-height "100vh"}
    [:#output {:flex-grow 1}]
    ;; VS Code draws the border between two views under the right one's webview, along its left edge
    [:#repl-input {:position :sticky
                   :bottom 0
                   :margin-left "calc(1px - var(--calva-output-inset))"
                   :margin-right "calc(-1 * var(--calva-output-inset))"
                   :padding [["6px" "var(--calva-output-inset)" "6px" "calc(var(--calva-output-inset) - 1px)"]]
                   :background-color "var(--vscode-editor-background)"
                   :border-top [["1px" :solid "var(--vscode-panel-border, rgba(128, 128, 128, 0.35))"]]}
     ["&[data-repl-input-id=\"output-sidebar\"]"
      {:background-color "var(--vscode-sideBar-background, var(--vscode-editor-background))"}]]]

   [:.repl-input-sash {:position :absolute
                       :z-index 35
                       :top "-3px"
                       :left 0
                       :right 0
                       :height "4px"
                       :cursor :ns-resize
                       :touch-action :none}
    [:&.mac {:cursor :row-resize}]
    ["&::before" {:content "\"\""
                  :position :absolute
                  :inset 0
                  :pointer-events :none
                  :background-color :transparent
                  :transition [[:background-color "0.1s" :ease-out]]}]
    ["&:hover::before" {:background-color "var(--vscode-sash-hoverBorder)"
                        :transition-delay "300ms"}]
    ["&.active::before" {:background-color "var(--vscode-sash-hoverBorder)"
                         :transition-delay "0s"}]]

   [:body.repl-input-on
    [:.output-greeting-read-only {:display :none}]]])

(def context-line
  "The context line and its buttons."
  [[:.repl-input-context {:display :flex
                          :align-items :center
                          :gap "0.4em"
                          :padding-bottom "4px"
                          :font-size "calc(0.9 * var(--vscode-font-size, 13px) * var(--calva-output-font-scale, 1))"}]

   [:.repl-input-context-line {:display :flex
                               :flex-grow 1
                               :min-width 0
                               :overflow :hidden
                               :gap [[0 "0.4em"]]
                               :white-space :nowrap
                               :color "var(--vscode-descriptionForeground)"}]

   [:.repl-input-context-button {:display :flex
                                 :flex-shrink 0
                                 :margin [["-3px" 0]]
                                 :padding "2px"
                                 :color "var(--vscode-icon-foreground, var(--vscode-foreground))"
                                 :background :none
                                 :border :none
                                 :border-radius "5px"
                                 :cursor :pointer}
    ["&[hidden]" {:display :none}]
    [:&:hover {:background-color "var(--vscode-toolbar-hoverBackground)"}]
    [:&:focus-visible {:outline [["1px" :solid "var(--vscode-focusBorder)"]]
                       :outline-offset "-1px"}]]

   [:.repl-input-context-icon {:width "16px"
                               :height "16px"
                               :fill :currentColor
                               :fill-rule :evenodd}]])

(def context-line-controls
  "The namespace indicator, the play button and the connect link."
  [[:.repl-input-indicator {:flex-shrink 1
                            :align-items :center
                            :gap "4px"
                            :min-width 0
                            :padding [["2px" "4px" "2px" "2px"]]
                            :font :inherit
                            :white-space :nowrap}
    ["&[data-mode=\"following\"]" {:cursor :default}
     [:&:hover {:background :none}]]
    [:.repl-input-context-ns {:min-width 0
                              :overflow :hidden
                              :text-overflow :ellipsis}]]

   [:.repl-input-indicator-chevron {:flex-shrink 0}]

   [:.repl-input-evaluate {:color "var(--vscode-debugIcon-startForeground)"}]

   [".repl-input-context-button[aria-disabled=\"true\"]" {:opacity 0.4
                                                          :cursor :default}
    [:&:hover {:background :none}]]

   [:.repl-input-context-line
    ["> span::before" {:content "\"· \""}]]

   [:.repl-input-context-ns {:color "var(--vscode-foreground)"}]

   [:.repl-input-context-connect {:flex-shrink 0
                                  :cursor :pointer
                                  :color "var(--vscode-textLink-foreground)"}
    ["&::before" {:display :inline-block
                  :white-space :pre
                  :color "var(--vscode-descriptionForeground)"}]
    [:&:hover {:color "var(--vscode-textLink-activeForeground)"
               :text-decoration :underline}]]])

(def evaluation-bar
  "The bar shown while an evaluation runs."
  [[:.repl-input-evaluation-bar {:display :flex
                                 :align-items :center
                                 :justify-content :space-between
                                 :gap "0.5em"
                                 :margin-bottom "4px"
                                 :padding [["2px" "6px"]]
                                 :font-size "calc(0.9 * var(--vscode-font-size, 13px) * var(--calva-output-font-scale, 1))"
                                 :color "var(--vscode-foreground)"
                                 :background-color "var(--vscode-editorWidget-background)"
                                 :border-left [["2px" :solid "var(--vscode-progressBar-background)"]]}
    ["&[hidden]" {:display :none}]]

   [:.repl-input-interrupt {:padding [["1px" "8px"]]
                            :font :inherit
                            :color "var(--vscode-button-secondaryForeground)"
                            :background-color "var(--vscode-button-secondaryBackground)"
                            :border :none
                            :border-radius "2px"
                            :cursor :pointer}
    [:&:hover {:background-color "var(--vscode-button-secondaryHoverBackground)"}]]])

(def stdin
  "The stdin input."
  [[:.repl-input-stdin {:display :flex
                        :align-items :center
                        :gap "4px"
                        :margin-bottom "6px"
                        :font-family "var(--vscode-editor-font-family, monospace)"
                        :font-size "calc(var(--vscode-editor-font-size, 12px) * var(--calva-output-font-scale, 1))"}
    ["&[hidden]" {:display :none}]
    [:input {:flex-grow 1
             :min-width 0
             :padding [["3px" "4px"]]
             :font :inherit
             :color "var(--vscode-input-foreground)"
             :background-color "var(--vscode-input-background)"
             :border [["1px" :solid "var(--vscode-input-border, transparent)"]]}
     [:&:focus {:outline [["1px" :solid "var(--vscode-focusBorder)"]]
                :outline-offset "-1px"}]
     ["&::placeholder" {:color "var(--vscode-input-placeholderForeground)"}]]]

   [:.repl-input-stdin-icon {:flex-shrink 0
                             :width "16px"
                             :height "16px"
                             :fill :currentColor}]

   [:.repl-input-stdin-prompt {:color "var(--vscode-icon-foreground, var(--vscode-foreground))"}]

   [:.repl-input-stdin-stop {:display :flex
                             :padding "3px"
                             :color "var(--vscode-icon-foreground, var(--vscode-foreground))"
                             :background :none
                             :border :none
                             :border-radius "5px"
                             :cursor :pointer}
    [:&:hover {:background-color "var(--vscode-toolbar-hoverBackground)"}]]])

(def menu
  "The namespace menu."
  [[:.repl-input-menu {:position-area [[:bottom :span-right]]
                       :position-try-fallbacks [[:top :span-right] [:bottom :span-left] [:top :span-left]]
                       :inset :auto
                       :max-width "calc(100vw - 8px)"
                       :margin [["2px" 0]]
                       :padding "4px"
                       :box-sizing :border-box
                       :font-family "var(--vscode-font-family)"
                       :font-size "calc(0.9 * var(--vscode-font-size, 13px) * var(--calva-output-font-scale, 1))"
                       :color "var(--vscode-menu-foreground)"
                       :background-color "var(--vscode-menu-background)"
                       :border [["1px" :solid "var(--vscode-menu-border, transparent)"]]
                       :border-radius "5px"
                       :box-shadow [[0 "2px" "8px" "var(--vscode-widget-shadow)"]]}]

   [:.repl-input-menu-item {:display :flex
                            :align-items :center
                            :gap "6px"
                            :width "100%"
                            :padding [["3px" "8px"]]
                            :font :inherit
                            :white-space :nowrap
                            :text-align :start
                            :color :inherit
                            :background :none
                            :border :none
                            :border-radius "3px"
                            :cursor :pointer}
    [:&:hover :&:focus {:color "var(--vscode-menu-selectionForeground)"
                        :background-color "var(--vscode-menu-selectionBackground)"
                        :outline [["1px" :solid "var(--vscode-menu-selectionBorder, transparent)"]]
                        :outline-offset "-1px"}]]

   [:.repl-input-menu-ns {:min-width 0
                          :overflow :hidden
                          :text-overflow :ellipsis}]

   [:.repl-input-menu-session :.repl-input-menu-detail {:flex-shrink 0
                                                        :opacity 0.7}]

   [:.repl-input-menu-session
    [:&:empty {:display :none}]]])
