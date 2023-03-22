(ns calva.html2hiccup
  (:require ["posthtml-parser" :as posthtml-parser]
            [camel-snake-kebab.core :as csk]
            [clojure.string :as string]))

(defn- html->ast [html]
  (-> (.parser posthtml-parser html #js {:recognizeNoValueAttribute true})
      (js->clj :keywordize-keys true)))

(defn- comment? [x]
  (and (string? x) (.startsWith x "<!--") (.endsWith x "-->")))

(def ^:private special-attr-cases {"viewbox" "viewBox"
                                   "baseprofile" "baseProfile"})

(defn- normalize-attr-keys [m {:keys [kebab-attrs?]}]
  (into {} (map (fn [[k v]]
                  (let [s (name k)
                        transformed-k (keyword (or (special-attr-cases (string/lower-case s))
                                                   (if kebab-attrs?
                                                     (csk/->kebab-case s)
                                                     (string/lower-case s))))]
                    [transformed-k v])) m)))

;; TODO: We can go really fancy here, but for now, just some best effort
(defn- normalize-css-value [v]
  (cond
    (= (str (js/parseFloat v)) v) (js/parseFloat v)
    (re-find #"^[a-zA-Z]+$" v) (keyword v)
    :else (str v)))

(defn- mapify-style [style-str]
  (try
    (into {} (for [[_ k v] (re-seq #"(\S+):\s+([^;]+);?" style-str)]
               [(-> k string/lower-case keyword) (normalize-css-value v)]))
    (catch :default e
      (js/console.warn "Failed to mapify style: '" style-str "'." (.-message e))
      style-str)))

(defn- normalize-attrs [attrs options]
  (if (and (:style attrs)
           (:mapify-style? options))
    (-> (normalize-attr-keys attrs options) (update :style mapify-style))
    (normalize-attr-keys attrs options)))

(defn- element->hiccup [{:keys [tag attrs content] :as element} options]
  (if tag
    (let [normalized-attrs (normalize-attrs attrs options)
          {:keys [id class]} normalized-attrs
          tag-w-id (str (string/lower-case tag) (some->> id (str "#")))
          classes (some-> class (string/split " "))
          tag-w-id+classes (str tag-w-id (when (seq classes)
                                           (str "." (some->> classes (string/join ".")))))
          remaining-attrs (dissoc normalized-attrs :class :id)]
      (into (cond-> [(keyword tag-w-id+classes)]
              (seq remaining-attrs) (conj remaining-attrs))
            (map #(element->hiccup % options) (remove string/blank? content))))
    (if (comment? element)
      (list 'comment (string/replace element #"^<!--\s*|\s*-->$" ""))
      element)))

(defn- ast->hiccup [fragments options]
  (mapv #(element->hiccup % options) fragments))

(defn html->hiccup
  "Returns Hiccup for the provided HTML string
   * Turns HTML comments into `(comment ...)` forms
   * Lowercases tags and attributes
   * Removes whitespace nodes
   * Normalizes attrs `viewBox` and `baseProfile` to camelCase (for SVG)

   `options` is a map: 
   * `:mapify-style?`: tuck the style attributes into a map (Reagent style)
   * `:kebab-attrs?`: kebab-case any camelCase or snake_case attribute names"
  ([html]
   (html->hiccup html nil))
  ([html options]
   (-> html html->ast (ast->hiccup options))))

(comment
  (html->ast "<Foo id='foo-id' class='clz1 clz2' style='color: blue'><!--comment-->  <bar>foo</bar></foo><bar>foo</bar>")

  (html->hiccup "<foo style='font-family: -apple-system,BlinkMacSystemFont,\"Segoe UI\",\"Noto Sans\",Helvetica,Arial,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\";'></foo>" {:mapify-style? true})
  (html->hiccup "<Foo id='foo-id' class='clz1 clz2' style='color: blue; foo'><!--comment-->
        <bar>foo</bar></foo><bar>foo</bar>")
  (html->hiccup "<div>
  <span style=\"color: blue; border: solid 1\">Hello World!</span>
  <!-- Can handle comments -->
  <a hreF=\"https://www.clojure.org\">Clojure website</a>
  <svg width=\"64\" height=\"64\" viewBox=\"0 0 64 64\" xmlns=\"http://www.w3.org/2000/svg\" baseProfile=\"full\">
    <rect x=\"16\" y=\"16\" width=\"32\" height=\"32\" fill=\"#ef4444\"/>
  </svg>
</div>")
  :rcf)

