(ns pretty-printing)

(def some-data
  [:div.save-buttons
   {:right "10px", :bottom "2px", :z-index "1030"}
   [:.btn
    {:font-size ".875rem !important",
     :line-height "1.3125rem !important",
     :padding ".25rem .5rem !important",
     :min-width "0 !important",
     :border "1px solid #ffa571 !important"}
    [:&:focus
     {:outline "0 !important",
      :box-shadow "none !important",
      :background-color :red}]]
   [:span
    {:font-size ".875rem !important",
     :line-height "1.3125rem !important",
     :padding ".25rem .5rem !important",
     :min-width "0 !important",
     :color :white}]
   [:.btn.disabled
    {:border "#ffa571 solid 1px",
     :background-color :blue,
     :opacity "50%",
     :color :white}] [:.pending {:opacity "100%"}]
   [:.saving
    {:animation "saving 2s ease-in-out infinite"}]
   [:.error {:color :white, :opacity "100%"}]])

some-data

(comment

  satisfies?
  

  )

#_{:clj-kondo/ignore [:redefined-var]}
(comment
  ;; Add-lib library for hot-loading
  (require '[clojure.tools.deps.alpha.repl :refer [add-libs]])
  (add-libs '{domain/library-name {:mvn/version "1.0.0"}})
  #__)


