(ns calva.docs.shell
  "The HTML document around each docs page."
  (:require [calva.docs.markdown :as markdown]
            [hiccup2.core :as h]))

(def ^:private live-reload-script
  "new WebSocket('ws://' + location.host + '/__reload').onmessage = () => location.reload();")

(defn page-html
  "Returns the HTML document for `page` in `site`."
  [{:site/keys [name] :build/keys [live-reload?]} {:page/keys [title markdown]}]
  (str "<!doctype html>\n"
       (h/html [:html {:lang "en"}
                [:head
                 [:meta {:charset "utf-8"}]
                 [:title (if title (str title " - " name) name)]]
                [:body
                 (h/raw (markdown/html markdown))
                 (when live-reload?
                   [:script (h/raw live-reload-script)])]])))
