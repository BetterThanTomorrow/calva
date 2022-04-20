(ns js-cljs.core
  (:require ["acorn" :refer [parse]]
            [zprint.core :as zprint]
            [clojure.string :as str]))

(defmulti parse-frag (fn [step state]
                       (when (and step (:debug state)) (reset! (:debug state) step))
                       (:type step)))

(defn- block [bodies state sep]
  (let [ops (->> bodies
                 (map #(parse-frag % state))
                 (remove nil?))
        body (str/join sep ops)
        locals (:locals state)]
    (cond
      (and locals (seq @locals)) (str "(let [" (str/join " " (mapcat identity @locals)) "] " body ")")
      (-> state :single? not (or (-> ops count (= 1)))) body
      :else (str "(do " body ")"))))

(defmethod parse-frag "Program" [step state]
  (block (:body step) (assoc state :root? true) "\n"))

(defmethod parse-frag "BlockStatement" [step state]
  (block (:body step) (assoc state :root? false :locals (atom [])) " "))

(defmethod parse-frag "ExpressionStatement" [step state]
  (parse-frag (:expression step) state))

(defmethod parse-frag "ForStatement" [{:keys [init test update body]} state]
  (let [[id val] (when init (parse-frag (-> init :declarations first) (assoc state :root? false)))
        test (if test
               (parse-frag test (assoc state :single? true))
               "true")
        add-let? (and init (not (:locals state)))]
    (str (when add-let?
           (str "(let [" id " " val "] "))
         "(while " test
         " " (block (:body body)
                    (assoc state :root? false :single? false :locals (atom []))
                    " ")
         (when update (str " " (parse-frag update (assoc state :single? false))))
         ")"
         (when add-let? ")"))))

(defn- get-operator [operator]
  (case operator
    "&&" "and"
    "||" "or"
    "==" "="
    "===" "="
    "!=" "not="
    "!==" "not="
    "!" "not"
    operator))

(defn- binary-exp [{:keys [left right operator]} state]
  (let [state (assoc state :single? true)
        left (parse-frag left state)
        right (parse-frag right state)]
    (if (= operator "??")
      (str "(if (some? " left ") " left " " right ")")
      (str "(" (get-operator operator) " " left " " right ")"))))

(defmethod parse-frag "UnaryExpression" [{:keys [operator argument]} state]
  (let [operator (get-operator operator)]
    (str "(" operator " " (parse-frag argument (assoc state :single? true)) ")")))

(defmethod parse-frag "BinaryExpression" [step state] (binary-exp step state))
(defmethod parse-frag "LogicalExpression" [step state] (binary-exp step state))

(defmethod parse-frag "Literal" [{:keys [value regex] :as p} _]
  (if regex
    (if-let [flags (-> regex :flags not-empty)]
      (str "#" (pr-str (str "(?" flags ")" (:pattern regex))))
      (str "#" (pr-str (:pattern regex))))
    (pr-str value)))

(defmethod parse-frag "Identifier" [{:keys [name]} _] name)

(defn- call-expr [{:keys [callee arguments]} state]
  (let [callee (parse-frag callee (assoc state :single? true :special-js? true))
        args (mapv #(parse-frag % (assoc state :single? true)) arguments)
        [non-rest [[fst] & rst]] (split-with (complement vector?) args)
        rest (cond
               (seq rst) [(str "(concat " fst " [" (str/join " " rst) "])")]
               fst [fst])]
    (if (string? callee)
      (if rest
        (str "(apply " (str/join " " (concat [callee] non-rest rest)) ")")
        (str "(" (->> args (cons callee) (str/join " ")) ")"))
      (str "(." (second callee) " " (first callee) " " (str/join " " args)
           ")"))))
(defmethod parse-frag "CallExpression" [prop state] (call-expr prop state))
(defmethod parse-frag "NewExpression" [props state]
  (call-expr (update-in props [:callee :name] str ".") state))

(defn- if-then-else [{:keys [test consequent alternate]} state]
  (if alternate
    (str "(if "
         (parse-frag test (assoc state :single? true))
         " " (parse-frag consequent (assoc state :single? true))
         " " (parse-frag alternate (assoc state :single? true))
         ")")
    (str "(when "
         (parse-frag test (assoc state :single? true))
         " " (parse-frag consequent state)
         ")")))

(defmethod parse-frag "IfStatement" [element state] (if-then-else element state))
(defmethod parse-frag "ConditionalExpression" [element state] (if-then-else element state))

(defn- random-identifier [] (gensym "-temp-"))
(defn- to-obj-params [fun param]
  (map (fn [[k v]] (str k " (.-" v " " fun ")")) param))

(defn- to-default-param [[fun default]]
  [fun (str "(if (undefined? " fun ") " default " " fun ")")])

(defn- normalize-params [params state]
  (let [params (map #(parse-frag % state) params)
        params-detailed (for [param params]
                          (if (vector? param)
                            (if (-> param first vector?)
                              (let [id (random-identifier)]
                                {:fun id :extracts-to (to-obj-params id param)})
                              {:fun (first param) :extracts-to (to-default-param param)})
                            {:fun param}))
        let-params (->> params-detailed (mapcat :extracts-to) (filter identity))]
    {:params (->> params-detailed (map :fun) (str/join " "))
     :lets (when (seq let-params) (str/join " " let-params))}))

(defmethod parse-frag "FunctionDeclaration" [{:keys [id params body]} state]
  (let [body (parse-frag body (assoc state :single? false))
        {:keys [params lets]} (normalize-params params state)
        norm-body (if lets
                    (str "(let [" lets "] " body ")")
                    body)]
    (str "(defn " (parse-frag id state) " [" params "] " norm-body ")")))

(defn- parse-fun [{:keys [id params body]} state]
  (let [params (->> params (map #(parse-frag % state)) (str/join " "))
        body (parse-frag body (assoc state :single? false))]
    (str "(fn"
         (when-let [name (some-> id (parse-frag state))]
           (str " " name))
         " [" params "] " body ")")))

(defmethod parse-frag "FunctionExpression" [step state] (parse-fun step state))
(defmethod parse-frag "ArrowFunctionExpression" [step state] (parse-fun step state))

(defmethod parse-frag "ReturnStatement" [{:keys [argument]} state]
  (if argument
    (parse-frag argument state)
    "(js* \"return\")"))

(defmethod parse-frag "ForOfStatement" [{:keys [left right body]} state]
  (str "(doseq [" (-> left :declarations first :id :name)
       " " (parse-frag right (assoc state :single? true))
       "] " (parse-frag body (assoc state :single? false)) ")"))

(defmethod parse-frag "ForInStatement" [{:keys [left right body]} state]
  (str "(doseq [" (-> left :declarations first :id :name)
       " (js/Object.keys " (parse-frag right (assoc state :single? true))
       ")] " (parse-frag body (assoc state :single? false)) ")"))

(defn- template-lit [tag {:keys [expressions quasis]} state]
  (when tag
    (swap! (:cljs-requires state) conj '[shadow.cljs.modern :as modern]))
  (let [state (assoc state :single? true)
        elems (interleave quasis expressions)
        parsed (mapv #(parse-frag % state) elems)
        last (-> quasis peek (parse-frag state))
        parsed (cond-> parsed (not= last "\"\"") (conj last))]
    (cond
      tag (str "(modern/js-template " (parse-frag tag state) " "
               (str/join " " parsed) ")")
      (seq parsed) (str "(str " (str/join " " parsed) ")")
      :else "\"\"")))

(defmethod parse-frag "TaggedTemplateExpression" [{:keys [tag quasi]} state]
  (template-lit tag quasi state))
(defmethod parse-frag "TemplateLiteral" [prop state]
  (template-lit nil prop state))

(defmethod parse-frag "TemplateElement" [{:keys [value]} _] (pr-str (:cooked value)))

(defmethod parse-frag "ThrowStatement" [{:keys [argument]} state]
  (str "(throw " (parse-frag argument state) ")"))

(defmethod parse-frag "AssignmentExpression" [{:keys [operator left right] :as a} state]
  (let [vars (parse-frag left (assoc state :single? true :special-js? true))
        val (parse-frag right (assoc state :single? true))
        attr (-> vars second delay)
        obj (delay (let [f (first vars)]
                     (if (vector? f) (str "(.-" (second f) " " (first f) ")") f)))]

    (cond
      (string? vars)
      (str "(js* " (pr-str (str "~{} " operator " ~{}")) " " vars " " val ")")

      (:computed left)
      (str "(aset " @obj " " @attr " " val ")")

      :else
      (str "(aset " @obj " " (pr-str @attr) " " val ")"))))

(defn- make-destr-def [[k v] val]
  (str "(def " k " (.-" v " " val "))"))

(defmethod parse-frag "VariableDeclaration" [{:keys [declarations]} state]
  (let [declarations (mapv #(parse-frag % state) declarations)]
    (when (:root? state)
      (let [defs (for [[k v] declarations]
                   (if (vector? k)
                     (if (-> k count (= 1))
                       (make-destr-def (first k) v)
                       (let [sym (random-identifier)
                             inner (map #(make-destr-def % sym) k)]
                         (str "(let [" sym " " v "] " (str/join " " inner) ")")))
                     (if (and (string? v) (str/starts-with? v "(fn "))
                       (str "(defn " k " " (subs v 4))
                       (str "(def " k " " v ")"))))]
        (str/join " " defs)))))

(defmethod parse-frag "ContinueStatement" [_ _] "(js* \"continue\")")

(defmethod parse-frag "VariableDeclarator" [{:keys [id init]} state]
  (let [vars (:locals state)
        init (if init
               (parse-frag init (assoc state :single? true))
               "nil")
        body [(parse-frag id (assoc state :single? true)) init]]
    (if vars
      (swap! vars conj body)
      body)))

(defmethod parse-frag "ObjectExpression" [{:keys [properties]} state]
  (let [kvs (->> properties
                 (map #(parse-frag % (assoc state :single? true)))
                 (map (fn [[k v]] (str ":" k " " v))))]
    (str "#js {" (str/join " " kvs) "}")))

(defmethod parse-frag "ArrayExpression" [{:keys [elements]} state]
  (let [vals (map #(parse-frag % (assoc state :single? true)) elements)]
    (str "#js [" (str/join " " vals) "]")))

(defmethod parse-frag "Property" [{:keys [key value]} state]
  [(parse-frag key (assoc state :single? true))
   (parse-frag value (assoc state :single? true))])

(defmethod parse-frag "MemberExpression" [{:keys [object property computed] :as m} state]
  (let [obj (parse-frag object state)
        prop (parse-frag property state)]
    (if (:special-js? state)
      [obj prop]
      (cond
        (not computed) (str "(.-" prop " " obj ")")
        (re-matches #"\"?\d+\"?" prop) (str "(nth " obj " " (js/parseInt prop) ")")
        :else (str "(aget " obj " " prop ")")))))

(defmethod parse-frag "ObjectPattern" [{:keys [properties]} state]
  (mapv #(parse-frag % (assoc state :single? true))
        properties))

(defmethod parse-frag "AssignmentPattern" [{:keys [left right]} state]
  [(parse-frag left (assoc state :single? true))
   (parse-frag right (assoc state :single? true))])

(defmethod parse-frag "SpreadElement" [{:keys [argument]} state]
  [(parse-frag argument state)])

(defn- gen-properties [class [property {:keys [get set]}]]
  (str "(.defineProperty js/Object (.-prototype " class
       ") " (pr-str property) " #js {"
       (when get
         (str ":get (fn [] " (str/replace-first get #".*this\]" "(this-as this")))
       (when set
         (let [[_ params] (re-find #"\[this (.*)\]" set)]
           (str ":set (fn [" params "] "
                (str/replace-first set #".*this.*\]" "(this-as this"))))
       ")})"))

(defn- class-declaration [{:keys [id, superClass, body]} state]
  (swap! (:cljs-requires state) conj '[shadow.cljs.modern :as modern])
  (let [class-name (parse-frag id state)
        {:keys [constructor methods properties]} (parse-frag body state)
        super (some-> superClass (parse-frag state))
        defclass (str "(modern/defclass " class-name
                      (when super (str " (extends " super ")"))
                      " "
                      (if constructor constructor "(constructor [this])")
                      (when (seq methods)
                        (->> methods (cons " Object") (str/join " ")))
                      ")")]
    (cond-> defclass
      properties (str (->> properties
                           (map #(gen-properties class-name %))
                           (cons "")
                           (str/join " "))))))

(defmethod parse-frag "ClassDeclaration" [props state] (class-declaration props state))
(defmethod parse-frag "ClassExpression" [props state] (class-declaration props state))

(defmethod parse-frag "ClassBody" [{:keys [body]} state]
  (let [state (assoc state :js-class? true)]
    (reduce (fn [acc b]
              (case (:kind b)
                "constructor" (assoc acc :constructor (parse-frag b state))
                "get" (assoc-in acc [:properties (-> b :key :name) :get] (parse-frag b state))
                "set" (assoc-in acc [:properties (-> b :key :name) :set] (parse-frag b state))
                (update acc :methods conj (parse-frag b state))))
            {:methods []}
            body)))

(defmethod parse-frag "MethodDefinition" [{:keys [key value]} state]
  (let [{:keys [params body]} value
        {:keys [lets params]} (normalize-params params state)
        body (some->> (parse-frag body state) not-empty (str " "))
        norm-body (if lets
                    (str " (let [" lets "]" body ")")
                    body)]
    (str "(" (parse-frag key state)
         " [this" (cond->> params (seq params) (str " "))
         "]"
         norm-body
         ")")))

(defmethod parse-frag "ThisExpression" [_ state]
  (if (:js-class? state)
    "this"
    "(js* \"this\")"))

(defmethod parse-frag "TryStatement" [{:keys [block handler finalizer]} state]
  (str "(try " (parse-frag block state)
       (when handler
         (str " (catch :default " (parse-frag (:param handler) state)
              " " (parse-frag (:body handler) state) ")"))
       (when finalizer
         (str " (finally " (parse-frag finalizer state) ")"))
       ")"))

(defmethod parse-frag "SwitchStatement" [{:keys [discriminant cases]} state]
  (let [state (assoc state :single? true)
        test (parse-frag discriminant state)
        cases (map #(parse-frag % state) cases)]
    (str "(case " test
         " " (str/join " " cases)
         ")")))

(defmethod parse-frag "SwitchCase" [{:keys [test consequent]} state]
  (let [body (block consequent state " ")]
    (if test
      (str (parse-frag test state) " " body)
      body)))

(defmethod parse-frag "ArrayPattern" [{:keys [elements]} state]
  (str "["
       (->> elements
            (map #(parse-frag % (assoc state :single? true)))
            (str/join " "))
       "]"))

(defmethod parse-frag "WhileStatement" [{:keys [test body]} state]
  (str "(while " (parse-frag test (assoc state :single? true))
       " " (parse-frag body (assoc state :single? false))
       ")"))

(defmethod parse-frag "BreakStatement" [_ _] nil)

(defmethod parse-frag "RestElement" [{:keys [argument]} state]
  (str "& " (parse-frag argument (assoc state :single? true))))

(defmethod parse-frag "UpdateExpression" [{:keys [operator prefix argument]} state]
  (let [macro (if prefix
                (str operator "~{}")
                (str "~{}" operator))]
    (str "(js* " (pr-str macro) " " (parse-frag argument (assoc state :single? true)) ")")))

(defmethod parse-frag :default [dbg state]
  (tap> dbg)
  (def t (:type dbg))
  (throw (ex-info (str "Not implemented: " (:type dbg))
                  {:element (:type dbg)})))

#_(parse-str "a++")

#_(from-js "a.b = 1")
#_(from-js "a[b] = 1")

(defn- from-js [code]
  (-> code
      (parse #js {:ecmaVersion 2020})
      js/JSON.stringify
      js/JSON.parse
      (js->clj :keywordize-keys true)))

(defn- add-requires [code requires]
  (cond->> code
    (seq requires)
    (str "(ns your.ns (:require " (str/join " " requires) ")) ")))

(defn parse-str
  ([code]
   (let [reqs (atom #{})]
     (-> code
         from-js
         (parse-frag {:cljs-requires reqs :debug (atom nil)})
         (add-requires @reqs))))
  ([code opts]
   (let [reqs (atom #{})]
     (-> code
         from-js
         (parse-frag (assoc (:format-opts opts) :cljs-requires reqs))
         (add-requires @reqs)
         (cond->
          (-> opts :zprint-opts :disable not)
           (zprint/zprint-file-str "file: example.cljs" (:zprint-opts opts)))))))
