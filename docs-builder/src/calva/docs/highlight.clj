(ns calva.docs.highlight
  "Fenced code as hiccup, with its tokens marked by the Pygments class names that Material's
  stylesheet colors."
  (:require [clojure.string :as string])
  (:import [java.util.regex Matcher]))

(def ^:private special-forms
  #{"." "catch" "def" "do" "finally" "fn" "if" "let" "loop" "new" "quote" "recur" "throw" "try" "var"})

(def ^:private declarations
  #{"declare" "definline" "definterface" "defmacro" "defmethod" "defmulti" "defn" "defn-" "defonce"
    "defprotocol" "defrecord" "defstruct" "deftest" "deftype" "ns"})

(def ^:private core-names (set (map str (keys (ns-publics 'clojure.core)))))

(defn- clojure-name [other-class]
  (fn [text]
    (cond
      (special-forms text) "k"
      (declarations text) "kd"
      (core-names text) "nb"
      :else other-class)))

(def ^:private shell-keywords
  #{"case" "do" "done" "elif" "else" "esac" "fi" "for" "function" "if" "in" "then" "until" "while"})

(def ^:private shell-builtins
  #{"alias" "cd" "echo" "eval" "exec" "exit" "export" "printf" "read" "set" "source" "unset"})

(defn- shell-word [text]
  (cond
    (shell-keywords text) "k"
    (shell-builtins text) "nb"
    (re-matches #"\d+" text) "m"))

(def ^:private clojure-symbol "(?!#)[\\w!$%*+<=>?/.#|-]+")

(def ^:private double-quoted #"\"(?:\\.|[^\"\\])*\"")

(def ^:private javascript-rules
  [[#"//.*" "c1"]
   [#"/\*[\s\S]*?\*/" "c1"]
   [double-quoted "s2"]
   [#"'(?:\\.|[^'\\])*'" "s1"]
   [#"`(?:\\.|[^`\\])*`" "sb"]
   [(str "\\b(?:abstract|any|as|async|await|boolean|break|case|catch|class|const|continue"
         "|declare|default|do|else|enum|export|extends|false|finally|for|from|function|if"
         "|implements|import|interface|let|namespace|never|null|number|of|private|protected"
         "|public|readonly|return|static|string|super|switch|this|throw|true|try|type"
         "|undefined|unknown|var|while|yield)\\b")
    "k"]
   [#"\b(?:delete|in|instanceof|new|typeof|void)\b" "ow"]
   [#"[A-Za-z_$][\w$]*" nil]
   [#"\d+(?:\.\d+)?" "m"]
   [#"=>|[{}\[\]();,.]" "p"]
   [#"[=!<>+\-*/%&|^~?:]+" "o"]])

(def ^:private rules
  "Each language's tokens, as a regex and the class, or a function from the token text to the
  class. Rules are tried in order, and text no rule matches is plain."
  {:clojure [[#";.*" "c1"]
             [double-quoted "s"]
             [#"\\(?:newline|space|tab|formfeed|backspace|return|u[0-9a-fA-F]{4}|.)" "sc"]
             [(str "::?" clojure-symbol) "ss"]
             [(str "'" clojure-symbol) "ss"]
             [#"-?\d+(?:[./]\d+)?" "m"]
             [#"~@|[`'#^~&@]" "o"]
             [(str "(?<=\\()" clojure-symbol) (clojure-name "nf")]
             [clojure-symbol (clojure-name "nv")]
             [#"[()\[\]{}]" "p"]]
   :json [[#"//.*" "c1"]
          [#"/\*[\s\S]*?\*/" "c1"]
          [(str double-quoted "(?=\\s*:)") "nt"]
          [double-quoted "s2"]
          [#"-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?" "m"]
          [#"\b(?:true|false|null)\b" "kc"]
          [#"[{}\[\]:,]" "p"]]
   :javascript javascript-rules
   :typescript (into [[#"(?<=[\w$?]:\s{0,4})[A-Za-z_$][\w$.]*" "kt"]] javascript-rules)
   :shell [[#"#.*" "c"]
           [#"'[^']*'" "s1"]
           [double-quoted "s2"]
           [#"&&|\|\||[|;=]" "o"]
           [#"[^\s='\"|;&]+" shell-word]]})

(defn- lexer [language-rules]
  {:lexer/pattern (re-pattern (string/join "|" (map (fn [[re]] (str "(" re ")")) language-rules)))
   :lexer/classes (mapv second language-rules)})

(def ^:private lexers (update-vals rules lexer))

(def ^:private languages
  {"bash" :shell "clj" :clojure "cljc" :clojure "cljs" :clojure "clojure" :clojure "edn" :clojure
   "javascript" :javascript "js" :javascript "json" :json "jsonc" :json "sh" :shell "shell" :shell
   "ts" :typescript "typescript" :typescript})

(defn- conj-plain [tokens text]
  (cond-> tokens (seq text) (conj [nil text])))

(defn- matched-token [{:lexer/keys [classes]} ^Matcher m]
  (let [class (some #(when (.group m (int (inc %))) (classes %)) (range (count classes)))
        text (.group m)]
    [(if (fn? class) (class text) class) text]))

(defn- scan [{:lexer/keys [pattern] :as lexer} source]
  (let [m (re-matcher pattern source)]
    (loop [pos 0 out []]
      (if (.find m)
        (recur (.end m) (conj (conj-plain out (subs source pos (.start m))) (matched-token lexer m)))
        (conj-plain out (subs source pos))))))

(defn tokens
  "Returns `source` as class and text pairs, by the rules for `language`. Plain text has a nil
  class, and all of `source` is plain when there are no rules for `language`."
  [language source]
  (if-let [lexer (some-> language string/lower-case languages lexers)]
    (scan lexer source)
    (conj-plain [] source)))

(defn code-block
  "Returns the `source` in `language` as Material's code block, in hiccup."
  [language source]
  [:div.highlight
   [:pre [:code (for [[class text] (tokens language source)]
                  (if class [:span {:class class} text] text))]]])

(comment
  (tokens "clojure" "(defn f [x] (inc x)) ; hi")
  (code-block "json" "{\"a\": 1}")
  :rcf)
