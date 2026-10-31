(ns calva.repl.webview.styles.copy-buttons
  "The styles of the copy buttons, the result blocks' from highlightjs-copy included."
  (:require [garden.stylesheet :as stylesheet]))

(def copy-button
  "The copy button, with its icon."
  [;; Every copy button in the Output views looks and behaves the same: the result, stdout, image
   ;; and error copy buttons are icon buttons in the top right corner, outside the flow, showing on hover or
   ;; focus. highlightjs-copy draws the result buttons, and its stylesheet loads after this one, so
   ;; its rules are matched with `body` in front.

   [:.output-copy-button "body .hljs-copy-button"
    {:position :relative
     :box-sizing :border-box
     :width "32px"
     :height "32px"
     :padding 0
     :overflow :hidden
     :text-indent "-9999px"
     :border [["1px" :solid "color-mix(in srgb, var(--vscode-foreground, #cccccc), transparent 80%)"]]
     :border-radius "0.25rem"
     :background-color "var(--vscode-editor-background, #1e1e1e)"
     :color "var(--vscode-foreground, #cccccc)"
     :cursor :pointer
     :transition [[:background-color "200ms" :ease]]}
    [:&:hover {:background-color "color-mix(in srgb, var(--vscode-foreground, #cccccc), var(--vscode-editor-background, #1e1e1e) 90%)"}]
    [:&:focus-visible {:outline [["1px" :solid "var(--vscode-focusBorder, #007fd4)"]]
                       :outline-offset "-1px"}]
    ["&::before" {:content "\"\""
                  :position :absolute
                  :top "50%"
                  :left "50%"
                  :width "1rem"
                  :height "1rem"
                  :transform "translate(-50%, -50%)"
                  :background-color :currentColor
                  :mask-image "url('data:image/svg+xml;utf-8,<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M6 5C5.73478 5 5.48043 5.10536 5.29289 5.29289C5.10536 5.48043 5 5.73478 5 6V20C5 20.2652 5.10536 20.5196 5.29289 20.7071C5.48043 20.8946 5.73478 21 6 21H18C18.2652 21 18.5196 20.8946 18.7071 20.7071C18.8946 20.5196 19 20.2652 19 20V6C19 5.73478 18.8946 5.48043 18.7071 5.29289C18.5196 5.10536 18.2652 5 18 5H16C15.4477 5 15 4.55228 15 4C15 3.44772 15.4477 3 16 3H18C18.7956 3 19.5587 3.31607 20.1213 3.87868C20.6839 4.44129 21 5.20435 21 6V20C21 20.7957 20.6839 21.5587 20.1213 22.1213C19.5587 22.6839 18.7957 23 18 23H6C5.20435 23 4.44129 22.6839 3.87868 22.1213C3.31607 21.5587 3 20.7957 3 20V6C3 5.20435 3.31607 4.44129 3.87868 3.87868C4.44129 3.31607 5.20435 3 6 3H8C8.55228 3 9 3.44772 9 4C9 4.55228 8.55228 5 8 5H6Z\" fill=\"black\"/><path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M7 3C7 1.89543 7.89543 1 9 1H15C16.1046 1 17 1.89543 17 3V5C17 6.10457 16.1046 7 15 7H9C7.89543 7 7 6.10457 7 5V3ZM15 3H9V5H15V3Z\" fill=\"black\"/></svg>')"
                  :mask-repeat :no-repeat
                  :mask-size :contain
                  :mask-position [[:center :center]]}]]])

(def copied
  "The check a copy button shows once it copied."
  [;; highlightjs-copy shows "Copied!" as text; every copy button shows a check instead

   ["body .hljs-copy-button[data-copied=\"true\"]" {:width "32px"
                                                    :text-indent "-9999px"}]

   [".output-copy-button[data-copied=\"true\"]::before"
    "body .hljs-copy-button[data-copied=\"true\"]::before"
    {:mask-image "url('data:image/svg+xml;utf-8,<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M14.431 3.323l-8.47 10-.79-.036-3.35-4.77.818-.574 2.978 4.24 8.051-9.506.764.646z\"/></svg>')"}]])

(def showing
  "Where the copy buttons are, and when they show."
  [[:.output-copy-button "body .hljs-copy-container[data-autohide=\"true\"]"
    {:opacity 0
     :transform :none
     :transition [[:opacity "200ms" :ease-out] [:background-color "200ms" :ease]]}]

   [".output-image-thumbnail:hover .output-copy-button"
    ".output-stdout:hover .output-copy-button"
    ".output-error:hover .output-copy-button"
    ".output-copy-button:focus-visible"
    ".output-copy-button[data-copied=\"true\"]"
    "body .hljs-copy-wrapper:hover .hljs-copy-container"
    "body .hljs-copy-wrapper:focus-within .hljs-copy-container"
    "body .hljs-copy-container:has([data-copied=\"true\"])"
    {:opacity 1}]

   [:.output-image-copy :.output-error-copy :.output-stdout-copy {:position :absolute
                                                                  :top 0
                                                                  :right 0}]

   [:.output-image-copy {:margin "8px"}]

   [:.output-stdout {:position :relative}]

   (stylesheet/at-media {:prefers-reduced-motion nil}
                        [:.output-copy-button
                         "body .hljs-copy-button"
                         "body .hljs-copy-container[data-autohide=\"true\"]"
                         {:transition :none}])])
