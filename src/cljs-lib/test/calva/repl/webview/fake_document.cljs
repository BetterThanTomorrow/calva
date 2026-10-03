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
        children #js []]
    (js/Object.defineProperty style "setProperty" #js {:value (fn [k v] (aset style k v))})
    #js {:tagName (.toUpperCase tag)
         :classList #js {:names class-names
                         :add (fn [& names] (run! #(.push class-names %) names))}
         :attributes attributes
         :style style
         :dataset #js {}
         :children children
         :setAttribute (fn [k v] (aset attributes k v))
         :appendChild (fn [child] (.push children child) child)
         :addEventListener (fn [& _])}))

(when-not (exists? js/document)
  (set! js/globalThis.document
        #js {:getElementById (fn [_])
             :createElement create-element
             :createElementNS (fn [_ tag] (create-element tag))
             :createTextNode (fn [text] #js {:nodeType 3 :textContent text})}))
