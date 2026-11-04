(ns calva.repl.webview.near-colors
  "Colors the printed code in the output blocks near the view, and draws the code in the blocks far from it
   without its spans, which are most of a full page's nodes. The viewport observer reports which blocks are
   near. A far block keeps its spans while it holds printed code's editor or the selection reaches into it."
  (:require
   [calva.repl.webview.code-highlight :as code-highlight]
   [calva.repl.webview.printed-code.editor :as printed-code-editor]))

(defn- reports
  []
  {:reported (js/WeakSet.) :near (js/WeakSet.)})

(defonce ^{:private true :doc "The blocks the viewport observer has reported, and of those, the ones near the view."}
  !reports
  (atom (reports)))

(defonce ^{:private true :doc "The far blocks that keep their spans for printed code's editor or the selection."}
  !kept
  (js/Set.))

(defn forget-reports!
  "Forgets which blocks the viewport observer has reported, so every block counts as near until it reports
   them again."
  []
  (reset! !reports (reports)))

(defn near?
  "True when the viewport observer has reported `block` near the view, or hasn't reported it yet."
  [^js block]
  (let [{:keys [^js reported ^js near]} @!reports]
    (or (not (.has reported block))
        (.has near block))))

(defn output-block
  "Returns the output block, a child of `#output`, that holds `element`, or nil."
  [^js element]
  (->> (iterate #(.-parentElement ^js %) element)
       (take-while some?)
       (some #(when (= "output" (some-> ^js % .-parentElement .-id)) %))))

(defn- selection-reaches?
  [^js block]
  (when-let [get-selection (.-getSelection js/globalThis)]
    (let [^js selection (.call get-selection js/globalThis)]
      (boolean (and selection
                    (not (.-isCollapsed selection))
                    (.containsNode selection block true))))))

(defn- kept?
  "True when `block` holds printed code's editor or the selection reaches into it."
  [^js block]
  (or (some->> (printed-code-editor/open-code) (.contains block))
      (selection-reaches? block)))

(defn- spans?
  [^js code]
  (some? (.querySelector code "span")))

(defn- color-code!
  "Draws the spans of the `code` element with the colors it was last drawn with, when the grammar colored it
   and it is drawn without them."
  [^js code]
  (when (and (= "grammar" (.. code -dataset -highlighted))
             (not (spans? code)))
    (when-let [{:keys [ranges marks]} (printed-code-editor/drawn-colors code)]
      (code-highlight/set-spans! code (.-textContent code) ranges marks))))

(defn- uncolor-code!
  "Draws the `code` element as its text, without its spans."
  [^js code]
  (when (spans? code)
    (set! (.-textContent code) (.-textContent code))))

(defn- codes
  [^js block]
  (array-seq (.querySelectorAll block "code.clojure-code")))

(defn set-near!
  "Records whether `block` is near the view, `near-now?`. Colors its code when it is near, and draws it
   without its spans when it is far and nothing keeps them."
  [^js block near-now?]
  (let [{:keys [^js reported ^js near]} @!reports]
    (.add reported block)
    (if near-now?
      (.add near block)
      (.delete near block)))
  (cond
    near-now? (do (.delete !kept block)
                  (run! color-code! (codes block)))
    (kept? block) (.add !kept block)
    :else (run! uncolor-code! (codes block))))

(defn release-kept!
  "Draws the code of the far blocks kept colored without its spans, once printed code's editor and the
   selection have left them."
  []
  (doseq [^js block (js/Array.from !kept)]
    (cond
      (not (.-isConnected block)) (.delete !kept block)
      (near? block) (.delete !kept block)
      (not (kept? block)) (do (.delete !kept block)
                              (run! uncolor-code! (codes block))))))

(defn set-spans!
  "Sets the children of the `code` element to its text colored with `ranges` and marked with `marks` when its
   block is near the view or kept, and to its text alone when it is far."
  [^js code ranges marks]
  (let [block (output-block code)]
    (cond
      (or (nil? block) (near? block)) (code-highlight/set-spans! code (.-textContent code) ranges marks)
      (kept? block) (do (.add !kept block)
                        (code-highlight/set-spans! code (.-textContent code) ranges marks))
      :else (uncolor-code! code))))
