(ns calva.repl.webview.html
  "Renders hiccup to HTML for the Output views."
  (:require
   [clojure.string :as string]
   [replicant.string :as replicant]))

(defn render
  "Returns `hiccup` as HTML. Replicant writes a double quote as `&#39;`, the entity of an apostrophe, and
   every `&#39;` it escapes comes from a double quote, so they are written as `&quot;`. HTML parsing turns
   a carriage return into a line feed, so carriage returns are written as `&#13;`. `:innerHTML` is
   written as it is, apart from those two."
  [hiccup]
  (-> (replicant/render hiccup)
      (string/replace "&#39;" "&quot;")
      (string/replace "\r" "&#13;")))

(defn document
  "Returns the HTML document of `hiccup`, an `:html` element."
  [hiccup]
  (str "<!DOCTYPE html>" (render hiccup)))
