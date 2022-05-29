(ns calva-api-scratch
  (:require ["vscode" :as vscode]
            [joyride.core :as joyride]
            [promesa.core :as p]
            [z-joylib.editor-utils :as util]))

(def oc (joyride.core/output-channel))
(def calva (vscode/extensions.getExtension "betterthantomorrow.calva"))
(def calvaApi (-> calva
                  .-exports
                  .-v0
                  (js->clj :keywordize-keys true)))

(def evaluate (fn [code]
                ((get-in [:repl :evaluateCode] calvaApi)
                 "clj"
                 code
                 #js {:stdout #(.append oc %)
                      :stderr #(.append oc (str "Error: " %))})))

(defn top-level-form-text []
  #_(p/let [_ (vscode/commands.executeCommand "paredit.rangeForDefun")
            selection vscode/window.activeTextEditor.selection
            document vscode/window.activeTextEditor.document
            code (.getText document selection)]
      (vscode/commands.executeCommand "cursorUndo")
      code)
  (second ((get-in calvaApi [:ranges :currentTopLevelForm]))))

(defn evaluate-selection []
  (p/let [selection vscode/window.activeTextEditor.selection
          document vscode/window.activeTextEditor.document
          code (.getText document selection)
          result (.-result (evaluate code))]
    result))

(defn evaluate-top-level-form []
  (p/let [code (top-level-form-text)
          result (.-result (evaluate code))]
    result))

(defn paredit-sandbox []
  (p/do!
   (vscode/commands.executeCommand "paredit.dragSexprBackward")
   (vscode/commands.executeCommand "paredit.dragSexprBackward")
   (vscode/commands.executeCommand "paredit.dragSexprForward")
   (vscode/commands.executeCommand "paredit.wrapAroundParens")
   (vscode/commands.executeCommand "paredit.slurpSexpForward")
   (vscode/commands.executeCommand "paredit.backwardUpSexp")
   (vscode/commands.executeCommand "paredit.dragSexprBackwardUp")
   (util/insert-text!+ "#_")
   (vscode/commands.executeCommand "paredit.forwardSexp")
   (vscode/commands.executeCommand "paredit.forwardDownSexp")))

(comment
  {:foo 1234
   :bar
   {:foo 4321
    :bar :baz
    42 :question
    :answer 42}}
  (evaluate-top-level-form))

(comment
  (def eval1 (partial (get-in [:repl :evaluateCode] calvaApi) "clj"))

  (def evaluate (fn [code]
                  ((get-in [:repl :evaluateCode] calvaApi)
                   "clj"
                   code
                   #js {:stdout #(.append oc %)
                        :stderr #(.append oc (str "Error: " %))})))

  #_(def evaluate (get-in [:repl :evaluateCode] calvaApi))

  (-> (p/let [evaluation (evaluate "(println :foo) (+ 2 40)")]
        (.appendLine oc (str "=> " (.-result evaluation))))
      (p/catch (fn [e]
                 (.appendLine oc (str "Evaluation error: " e)))))
  #_(-> (p/let [evaluation (eval1 "[(println :forty-two) #_(in-ns 'some-ns) (println (str *ns* foo)) 42]")]
          (println "evaluation" evaluation)
          (println "ns" (.-ns evaluation))
          (println "output" (.-output evaluation))
          (println "result" (.-result evaluation))
          (def ev evaluation)
          evaluation
          #_(p/let [#_#_result (.-value evaluation)]
              #_(println result)
              evaluation))
        (p/catch (fn [e]
                   (.appendLine oc (str "Evaluation error: " e))))))

(comment
  ev
  (.-ns ev)
  (js-keys ev)
  (p/do! (println "ev.value" (.-value ev))))

(def gtlf (get-in calvaApi [:ranges :currentTopLevelForm]))
(def gcf (get-in calvaApi [:ranges :currentForm]))

;(def ate vscode/window.activeTextEditor)
;(def p vscode/window.activeTextEditor.selection.active)
{:ranges {:currentTopLevelForm (second (gtlf))
          :currentFormText (second (gcf))
          :currentFunction (second ((get-in calvaApi [:ranges :currentFunction])))
          :currentEnclosingForm (second ((get-in calvaApi [:ranges :currentEnclosingForm])))
          :currentTopLevelDef (second ((get-in calvaApi [:ranges :currentTopLevelDef])))
          :currentSessionKey ((get-in calvaApi [:repl :currentSessionKey]))}
 :repl {:evaluatedCode (-> ((get-in calvaApi [:repl :evaluateCode]) "cljc" "43")
                           (p/then (fn [result]
                                     (def result result)
                                     (.appendLine oc (str "Result: " (.-result result)))
                                     (.appendLine oc (str "ns: " (.-ns result)))))
                           (p/catch (fn [error]
                                      (.appendLine oc (str "Error evaluating: " error)))))
        :currentSessionKey ((get-in calvaApi [:repl :currentSessionKey]))}}
;(second (gtlf ate, p))