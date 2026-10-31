(ns calva.repl.webview.styles
  "The Output views' own styles, as Garden data. A rule's declarations are a map, so they come out in
   any order beyond eight. A shorthand and a longhand it sets go in separate maps, in the order they
   apply."
  (:require [calva.repl.webview.styles.copy-buttons :as copy-buttons]
            [calva.repl.webview.styles.errors :as errors]
            [calva.repl.webview.styles.images :as images]
            [calva.repl.webview.styles.output :as output]
            [calva.repl.webview.styles.repl-input :as repl-input]
            [garden.core :as garden]))

(def rules
  "The views' styles, as Garden rules, in the order they apply."
  (concat output/page
          output/text
          output/greeting
          output/evaluated-code
          output/ns-info
          images/forms
          images/thumbnails
          copy-buttons/copy-button
          copy-buttons/copied
          copy-buttons/showing
          images/image
          repl-input/layout
          repl-input/context-line
          repl-input/context-line-controls
          repl-input/evaluation-bar
          repl-input/stdin
          output/tooltip
          repl-input/menu
          errors/error
          errors/text
          errors/frames
          errors/filters
          errors/location))

(defn css
  "Returns the Output views' styles as CSS."
  []
  (garden/css rules))

(def help-rules
  "The styles of the Output Sidebar's help page."
  [[:body {:color "var(--vscode-foreground)"
           :background "var(--vscode-editor-background)"
           :font-family "var(--vscode-font-family)"
           :padding "16px"}]
   [:h1 {:font-size "1.2em"}]
   [:pre {:white-space :pre-wrap}]
   [:a {:color "var(--vscode-textLink-foreground)"}]])

(defn help-css
  "Returns the styles of the Output Sidebar's help page as CSS."
  []
  (garden/css help-rules))
