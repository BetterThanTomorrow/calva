(ns calva.repl.webview.copy-button
  "The copy button of the Output views, one look for every block that has one."
  (:require
   [calva.repl.webview.tooltip :as tooltip]
   [replicant.alias :refer-macros [defalias]]))

(defalias button
  "An icon button at the top right of its block that shows on hover or focus. `:copy/label` names what it
   copies, `:copy/tooltip`, the label when left out, is its tooltip, and `:copy/actions` are the actions a click
   dispatches. Other attributes, like `:class`, go on the button."
  [{:copy/keys [label tooltip actions] :as attrs}]
  [:button (merge {:type "button"
                   :aria-label label
                   :data-copy-label label
                   :data-action (pr-str actions)}
                  (dissoc attrs :copy/label :copy/tooltip :copy/actions)
                  {:class (into ["output-copy-button"] (:class attrs))}
                  (tooltip/attributes (or tooltip label)))])
