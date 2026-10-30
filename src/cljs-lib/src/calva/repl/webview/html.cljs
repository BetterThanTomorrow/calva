(ns calva.repl.webview.html
  "Renders hiccup to HTML for the Output views."
  (:require
   [clojure.string :as string]
   [replicant.string :as replicant]))

(defn render
  "Returns `hiccup` as HTML. Replicant writes a double quote as `&#39;`, the entity of an apostrophe, and
   every `&#39;` it escapes comes from a double quote, so they are written as `&quot;`. `:innerHTML` is
   written as it is, apart from that: a `&#39;` in it becomes `&quot;` too."
  [hiccup]
  (string/replace (replicant/render hiccup) "&#39;" "&quot;"))

(defn document
  "Returns the HTML document of `hiccup`, an `:html` element."
  [hiccup]
  (str "<!DOCTYPE html>" (render hiccup)))
