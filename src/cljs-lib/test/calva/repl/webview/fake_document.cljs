(ns calva.repl.webview.fake-document
  "A minimal `js/document` for loading `calva.repl.webview.ui` in node. `ui` reads the document when
   it loads, so a test namespace requires this namespace before `calva.repl.webview.ui`.

   Elements record what is done to them: `classList.names`, `attributes`, `style` and `children`.
   Properties set on an element (`src`, `width`, ...) become plain properties of it. An attribute
   set on an element sets its `dataset` entry or its property too, as in a browser.

   `insert-hiccup!` stands in for `calva.repl.webview.ui/insert-hiccup!`, which needs HTML parsing.
   Selectors are tags, classes and attributes, without combinators."
  (:require
   [clojure.string :as string]))

(def ^:private reflected-properties #{"id" "src" "alt" "title" "type"})

(defn- dataset-key
  [attribute]
  (string/replace (subs attribute (count "data-")) #"-([a-z])" #(string/upper-case (second %))))

(defn- set-attribute!
  [^js el attributes k v]
  (aset attributes k v)
  (cond
    (string/starts-with? k "data-") (aset (.-dataset el) (dataset-key k) v)
    (reflected-properties k) (aset el k v)))

(defn- matches?
  "True when the element `el` matches `selector`, made of a tag, classes and attributes."
  [^js el selector]
  (and (some? (.-tagName el))
       (every? (fn [[_ tag class-name attribute value]]
                 (cond
                   tag (= (string/upper-case tag) (.-tagName el))
                   class-name (.includes (.. el -classList -names) class-name)
                   value (= value (.getAttribute el attribute))
                   :else (some? (.getAttribute el attribute))))
               (re-seq #"^([a-z]+)|\.([\w-]+)|\[([\w-]+)(?:=\"([^\"]*)\")?\]" selector))))

(defn- child-elements
  [^js el]
  (filter #(some? (.-tagName ^js %)) (.-children el)))

(defn- descendant-elements
  [^js el]
  (mapcat #(cons % (descendant-elements %)) (child-elements el)))

(defn- add-tree-methods!
  "Gives the element `el` the methods that find, add and remove elements around it, and returns it."
  [^js el]
  (js/Object.defineProperty el "lastElementChild" #js {:get #(last (child-elements el))})
  (js/Object.defineProperty el "nextElementSibling"
                            #js {:get #(when-let [parent (.-parentNode el)]
                                         (second (drop-while (fn [child] (not (identical? child el)))
                                                             (child-elements parent))))})
  (set! (.-after el) (fn [^js sibling]
                       (let [^js parent (.-parentNode el)]
                         (set! (.-parentNode sibling) parent)
                         (.splice (.-children parent) (inc (.indexOf (.-children parent) el)) 0 sibling))))
  (set! (.-remove el) (fn [] (some-> ^js (.-parentNode el) (.removeChild el))))
  (set! (.-matches el) (fn [selector] (matches? el selector)))
  (set! (.-closest el) (fn [selector]
                         (first (filter #(matches? % selector)
                                        (take-while some? (iterate #(.-parentNode ^js %) el))))))
  (set! (.-querySelectorAll el) (fn [selector] (into-array (filter #(matches? % selector) (descendant-elements el)))))
  (set! (.-querySelector el) (fn [selector] (first (filter #(matches? % selector) (descendant-elements el)))))
  el)

(defn- create-element
  [tag]
  (let [class-names #js []
        attributes #js {}
        style #js {}
        children #js []
        el #js {}]
    (js/Object.defineProperty style "setProperty" #js {:value (fn [k v] (aset style k v))})
    (js/Object.defineProperty el "childElementCount" #js {:get (fn [] (.-length children))})
    (js/Object.defineProperty el "innerHTML"
                              #js {:configurable true
                                   :get (fn [] "")
                                   :set (fn [_]
                                          (doseq [i (range (.-length children))]
                                            (set! (.-parentNode (aget children i)) nil))
                                          (.splice children 0 (.-length children)))})
    (set! (.-tagName el) (.toUpperCase tag))
    (set! (.-classList el) #js {:names class-names
                                :add (fn [& names] (run! #(.push class-names %) names))})
    (set! (.-attributes el) attributes)
    (set! (.-style el) style)
    (set! (.-dataset el) #js {})
    (set! (.-children el) children)
    (set! (.-setAttribute el) (fn [k v] (set-attribute! el attributes k v)))
    (set! (.-getAttribute el) (fn [k] (aget attributes k)))
    (set! (.-appendChild el) (fn [child]
                               (set! (.-parentNode child) el)
                               (.push children child)
                               child))
    (set! (.-removeChild el) (fn [child]
                               (let [idx (.indexOf (js/Array.from children) child)]
                                 (when (>= idx 0)
                                   (.splice children idx 1)
                                   (set! (.-parentNode child) nil)))
                               child))
    (set! (.-calvaListeners el) #js [])
    (set! (.-addEventListener el) (fn [type f]
                                    (.push (.-calvaListeners el)
                                           #js {:type type :f f :src-when-added (.-src el)})))
    (set! (.-dispatchEvent el) (fn [_]))
    (add-tree-methods! el)))

(defn- text-node
  [text]
  #js {:nodeType 3 :textContent text})

(defn- hiccup-children
  [children]
  (mapcat #(if (seq? %) (hiccup-children %) [%]) (remove nil? children)))

(defn- set-hiccup-attribute!
  "Sets the attribute `k` of `el` as Replicant renders it: `true` as present, `nil` and `false` as absent."
  [^js el k v]
  (cond
    (or (nil? v) (false? v)) nil
    (= :class k) (run! #(.add (.-classList el) %) (if (string? v) [v] v))
    (= :innerHTML k) (set! (.-innerHTML el) v)
    :else (.setAttribute el (name k) (if (true? v) "" (str v)))))

(defn hiccup-element
  "Returns the element of `hiccup`, with its attributes and children. `:innerHTML` empties it."
  [[tag & [attrs & more :as children]]]
  (let [[attrs children] (if (map? attrs) [attrs more] [nil children])
        ^js el (create-element (name tag))]
    (doseq [[k v] attrs]
      (set-hiccup-attribute! el k v))
    (doseq [child (hiccup-children children)]
      (.appendChild el (if (vector? child) (hiccup-element child) (text-node (str child)))))
    el))

(defn insert-hiccup!
  "Inserts the element of `hiccup` at `position` of `element`, as `calva.repl.webview.ui/insert-hiccup!`
   does, and returns it."
  [^js element position hiccup]
  (let [new-element (hiccup-element hiccup)]
    (case position
      "beforeend" (.appendChild element new-element)
      "afterend" (.after element new-element))
    new-element))

(when-not (exists? js/document)
  (set! js/globalThis.CustomEvent (fn [name opts] #js {:type name :detail (.-detail opts)}))
  (set! js/globalThis.document
        #js {:readyState "complete"
             :getElementById (fn [_])
             :createElement create-element
             :createElementNS (fn [_ tag] (create-element tag))
             :createTextNode (fn [text] #js {:nodeType 3 :textContent text})
             :addEventListener (fn [& _])
             :querySelectorAll (fn [_sel]
                                 (this-as this
                                   (when-not (identical? this js/document)
                                     (throw (js/TypeError. "Illegal invocation")))
                                   #js []))}))

(when-not (.-body js/document)
  (set! (.-body js/document) (create-element "body")))

(when-not (.-documentElement js/document)
  (set! (.-documentElement js/document) (create-element "html")))

(when-not (fn? (.-querySelectorAll js/document))
  (set! (.-querySelectorAll js/document)
        (fn [_sel]
          (this-as this
            (when-not (identical? this js/document)
              (throw (js/TypeError. "Illegal invocation")))
            #js []))))
