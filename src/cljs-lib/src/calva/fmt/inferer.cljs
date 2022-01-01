(ns calva.fmt.inferer
  (:require ["@chrisoakman/parinfer" :as parinfer]
            [calva.js-utils :refer [cljify jsify]]
            [calva.fmt.editor :as editor]))

(defn infer-parens
  "Calculate the edits needed for infering parens in `text`,
   and where the cursor should be placed to 'stay' in the right place."
  [{:keys [text line character previous-line previous-character]}]
  (let [options {:cursorLine line
                 :cursorX character
                 :prevCursorLine previous-line
                 :prevCursorX previous-character
                 :partialResult true}
        result (cljify (parinfer/indentMode text (jsify options)))]
    (jsify
     (if (:success result)
       {:success true
        :line (:cursorLine result)
        :character (:cursorX result)
        :new-text (:text result)
        :edits (editor/replacement-edits-for-diffing-lines text (:text result))}
       {:success false
        :error-msg (-> result :error :message)
        :line (-> result :error :lineNo)
        :character (-> result :error :x)}))))

(defn infer-parens-bridge
  [^js m]
  (infer-parens (cljify m)))


(comment
  (let [o (jsify {:cursorLine 1 :cursorX 13})
        result (parinfer/indentMode "    (foo []\n      (bar)\n      (baz)))" o)]
    (cljify result))

  (infer-parens {:text "    (foo []\n      (bar)\n      (baz)))"
                 :line 2
                 :character 13})
  (infer-parens {:text "(f)))"
                 :line 0
                 :character 2}))

(defn infer-indents
  "Calculate the edits needed for infering indents in `text`,
   and where the cursor should be placed to 'stay' in the right place."
  [{:keys [text line character previous-line previous-character changes]}]
  (let [options {:cursorLine line
                 :cursorX character
                 :prevCursorLine previous-line
                 :prevCursorX previous-character
                 :changes (mapv (fn [change]
                                  {:lineNo (:line change)
                                   :x      (:character change)
                                   :oldText (:old-text change)
                                   :newText (:new-text change)})
                                changes)}
        result (cljify (parinfer/parenMode text (jsify options)))]
    (jsify
     (if (:success result)
       {:success true
        :line (:cursorLine result)
        :character (:cursorX result)
        :edits (editor/replacement-edits-for-diffing-lines text (:text result))}
       {:success false
        :error-msg (-> result :error :message)
        :line (-> result :error :lineNo)
        :character (-> result :error :x)}))))

(comment
  (def broken-indentation "
(ns foo
  (:require [clojure.string :refer [blank?
                                    lower-case
                                    split
                                  trim]])) ;; note: incorrect indentation

(def foo)
")

  (infer-indents {:text broken-indentation
                  :line 7
                  :character 8})

  (def good-indentation "
(ns foo
  (:require [clojure.string :refer [blank?
                                    lower-case
                                    split
                                    trim]])) ;; note: correct indentation

(def foo)
")

  (infer-indents {:text good-indentation
                  :line 7
                  :character 8})

  (def broken-structure "
(ns foo
  (:require [clojure.string :refer [blank?
                                    lower-case
                                    split
                                    trim])) ;; note: broken structure

(def foo)
")
  (infer-indents {:text broken-structure
                  :line 7
                  :character 8}))


(defn infer-indents-bridge
  [^js m]
  (infer-indents (cljify m)))


(comment ;; SCRAP
  (let [o (jsify {:cursorLine 1 :cursorX 4
                  :changes {:lineNo 1 :x 0 :oldText "" :newText " "}})
        result (parinfer/parenMode "  (defn a []\n     (foo []\n     (bar)\n     (baz)))" o)]
    (cljify result))

  (let [o (jsify {:cursorLine 1
                  :cursorX 3
                  :prevCursorLine 1
                  :prevCursorX 2
                  :changes [{:lineNo 1
                             :x 2
                             :oldText ""
                             :newText " "}]})
        result (parinfer/parenMode "(comment\n   (foo bar\n     baz))" o)]
    (cljify result))

  (let [o (jsify {:cursorLine 1
                  :cursorX 0
                  :prevCursorLine 0
                  :prevCursorX 8
                  :changes [{:lineNo 0
                             :x 8
                             :oldText ")"
                             :newText "\n)"}]})
        result (parinfer/smartMode "(--> foo\n)" o)]
    (cljify result))

  (let [o (jsify {:cursorLine 1
                  :cursorX 3
                  :prevCursorLine 1
                  :prevCursorX 2})
        result (parinfer/parenMode "(comment\n    (foo bar\n    baz))" o)]
    (cljify result))

  (infer-indents {:text "(comment \n   (foo bar \n     baz))"
                  :line 1
                  :character 3
                  :previous-line 1
                  :previous-character 2
                  :changes [{:line 1
                             :character 2
                             :old-text ""
                             :new-text " "}]})

  (infer-indents {:text "(comment\n\n   (foo bar \n     baz))"
                  :line 1
                  :character 0
                  :previous-line 1
                  :previous-character 0
                  :changes [{:line 0
                             :character 8
                             :old-text "\n   (foo bar \n     baz))"
                             :new-text "\n\n   (foo bar \n     baz))"}]})

  (infer-indents {:text "  (defn a []\n     (foo []\n     (bar)\n     (baz)))"
                  :line 1
                  :character 4
                  :changes [{:line 4
                             :character 0
                             :old-text ""
                             :new-text " "}]}))
