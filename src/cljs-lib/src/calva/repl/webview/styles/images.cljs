(ns calva.repl.webview.styles.images
  "The styles of results with images.")

(def forms
  "The images form and the raw form of a result."
  [["body[data-image-display=\"raw\"] [data-image-form=\"images\"]"
    "body:not([data-image-display=\"raw\"]) [data-image-form=\"raw\"]"
    {:display :none}]

   ;; Adjacent result segments in the images form share one printed result. Drop the browser
   ;; pre/code margins and theme padding between them so a removed or pending image row leaves
   ;; no gap.

   ["[data-image-form=\"images\"] > pre"
    ["&:not(:first-child)" {:margin-top 0}]
    ["&:not(:last-child)" {:margin-bottom 0}]
    ["&:not(:first-child) > code" {:padding-top 0}]
    ["&:not(:last-child) > code" {:padding-bottom 0}]]])

(def thumbnails
  "The rows of thumbnails, hidden while their images are pending."
  [[".output-image-thumbnail[data-pending=\"true\"]"
    "body[data-image-display=\"images\"] .output-image-thumbnail:has([data-image-kind=\"remote\"])"
    {:display :none}]

   [:.output-images {:display :flex
                     :flex-direction :column
                     :align-items :flex-start
                     :gap "8px"
                     :margin-block [["4px" "8px"]]
                     ;; margin-inline: calc(-1 * var(--calva-output-inset))
                     :box-sizing :border-box}]

   [".output-images:not(:has(.output-image-thumbnail:not([data-pending=\"true\"])))"
    {:display :none}]

   ["body[data-image-display=\"images\"] .output-images:not(:has(.output-image-thumbnail:not([data-pending=\"true\"]):not([data-image-kind=\"remote\"])))"
    {:display :none}]

   [:.output-image-thumbnail {:position :relative
                              :display :flex
                              :align-items :flex-start
                              :gap "4px"
                              :max-width "100%"}]])

(def image
  "The thumbnail image."
  [[:.output-image {:display :block
                    :box-sizing :border-box
                    :max-width "100%"
                    :max-height "400px"
                    :width :auto
                    :height :auto
                    :object-fit :contain
                    :border [["1px" :solid "var(--vscode-panel-border, rgba(128, 128, 128, 0.35))"]]}]])
