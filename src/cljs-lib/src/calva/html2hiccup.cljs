(ns calva.html2hiccup
  (:require ["posthtml-parser" :as posthtml-parser]
            [camel-snake-kebab.core :as csk]
            [clojure.string :as string]
            [calva.js-utils :refer [jsify cljify]]
            [zprint.core :as zprint]))

(def default-opts {:add-classes-to-tag-keyword? true})

(defn- html->ast [html]
  (->> (.parser posthtml-parser html #js {:recognizeNoValueAttribute true})
       cljify
       (remove string/blank?)
       (map #(if (string? %) (string/trim %) %))))

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
    (into {} (for [[_ k v] (re-seq #"(\S+?)\s*:\s*([^;]+);?" style-str)]
               [(-> k string/lower-case keyword) (normalize-css-value v)]))
    (catch :default e
      (js/console.warn "Failed to mapify style: '" style-str "'." (.-message e))
      style-str)))

(defn- normalize-attrs [attrs options]
  (if (and (:style attrs)
           (:mapify-style? options))
    (-> (normalize-attr-keys attrs options) (update :style mapify-style))
    (normalize-attr-keys attrs options)))

(defn- valid-as-hiccup-kw? [s]
  (and s
       (not (re-matches #"^\d.*|.*[./:#@~`\[\]\(\){}].*" s))))

(defn- tag+id [tag id]
  (str tag (when (valid-as-hiccup-kw? id)
             (str "#" id))))

(defn- bisect-all-by [pred coll]
  (let [{matching true, not-matching false} (group-by pred coll)]
    [matching not-matching]))

(defn- build-tag-with-classes [tag-w-id kw-classes]
  (str tag-w-id
       (when (seq kw-classes)
         (str "." (some->> kw-classes (string/join "."))))))

(defn- element->hiccup [{:keys [tag attrs content] :as element} options]
  (if tag
    (let [normalized-attrs (normalize-attrs attrs options)
          {:keys [id class]} normalized-attrs
          lowercased-tag (string/lower-case tag)
          tag+id (tag+id lowercased-tag id)
          classes (when class
                    (string/split class #"\s+"))
          [kw-classes remaining-classes] (if-not (:add-classes-to-tag-keyword? options)
                                           [() classes]
                                           (bisect-all-by valid-as-hiccup-kw? classes))
          tag-w-id+classes (build-tag-with-classes tag+id kw-classes)
          remaining-attrs (cond-> normalized-attrs
                            :always (dissoc :class)
                            (seq remaining-classes) (assoc :class (vec remaining-classes))
                            (valid-as-hiccup-kw? id) (dissoc :id))]
      (into (cond-> [(keyword tag-w-id+classes)]
              (seq remaining-attrs) (conj remaining-attrs))
            (map #(element->hiccup % options)
                 (->> content
                      (map #(if (string? %) (string/trim %) %))
                      (remove string/blank?)))))
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
   * `:kebab-attrs?`: kebab-case any camelCase or snake_case attribute names
   * `:add-classes-to-tag-keyword?`: use CSS-like class name shortcuts"
  ([html]
   (html->hiccup html default-opts))
  ([html options]
   (-> html html->ast (ast->hiccup (merge default-opts options)))))

(defn- pretty-print [f]
  (zprint/zprint-str f {:style :hiccup
                        :map {:comma? false}}))

(defn html->hiccup-convert [html options]
  (try
    {:result
     (->> (html->hiccup html (cljify options))
          (map pretty-print)
          (string/join "\n"))}
    (catch :default e
      {:error {:message "Error Converting HTML to Hiccup"
               :exception {:name (.-name e)
                           :message (.-message e)}}})))

(defn ^:export html->hiccup-convert-bridge [html options]
  (jsify (html->hiccup-convert html options)))

(comment
  (def foo 3)
  (def options nil)
  (def html "<div>
  <span style=\"color: blue; border: solid 1\">Hello World!</span>
  <!-- Can handle comments -->
  <a href=\"https://www.clojure.org\">Clojure website</a>
  <svg width=\"64\" maxHeight=\"64\" viewBox=\"0 0 64 64\" xmlns=\"http://www.w3.org/2000/svg\" baseProfile=\"full\">
    <rect x=\"16\" y=\"16\" width=\"32\" height=\"32\" fill=\"#ef4444\"/>
  </svg>
</div>

p

<foo>bar</foo> ")
  (html->ast "<Foo id='foo-id' class='clz1 clz2' style='color: blue'><!--comment-->  <bar>foo</bar></foo><bar>foo</bar>")
  (html->ast "<foo></foo>\n\n<bar></bar>")

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

