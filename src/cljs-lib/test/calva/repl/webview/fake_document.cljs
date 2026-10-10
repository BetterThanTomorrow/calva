(ns calva.repl.webview.fake-document
  "A minimal `js/document` for loading `calva.repl.webview.ui` in node. `ui` reads the document when
   it loads, so a test namespace requires this namespace before `calva.repl.webview.ui`.

   Elements record what is done to them: `classList.names`, `attributes`, `style` and `children`.
   Properties set on an element (`src`, `width`, ...) become plain properties of it.")

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
    (set! (.-setAttribute el) (fn [k v] (aset attributes k v)))
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
    el))

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

(when-not (fn? (.-querySelectorAll js/document))
  (set! (.-querySelectorAll js/document)
        (fn [_sel]
          (this-as this
            (when-not (identical? this js/document)
              (throw (js/TypeError. "Illegal invocation")))
            #js []))))
