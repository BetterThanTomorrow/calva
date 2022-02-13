(ns pez-rewrite-clj.node
  "Facade for node related namespaces."
  (:require [pez-rewrite-clj.node.coercer]
            [pez-rewrite-clj.node.protocols :as prot]
            [pez-rewrite-clj.node.keyword :as kw-node]
            [pez-rewrite-clj.node.seq :as seq-node]
            [pez-rewrite-clj.node.whitespace :as ws-node]
            [pez-rewrite-clj.node.token :as tok-node]
            [pez-rewrite-clj.node.comment :as cmt-node]
            [pez-rewrite-clj.node.forms :as fm-node]
            [pez-rewrite-clj.node.meta :as mt-node]
            [pez-rewrite-clj.node.stringz :as s-node]
            [pez-rewrite-clj.node.reader-macro :as rm-node]
            [pez-rewrite-clj.node.quote :as q-node]
            [pez-rewrite-clj.node.uneval :as ue-node]
            [pez-rewrite-clj.node.fn :as f-node]))





; *******************************
; see pez-rewrite-clj.node.protocols
; *******************************
(def tag
  "See [[protocols/tag]]"
  prot/tag)
(def sexpr
  "See [[protocols/sexpr]]"
  prot/sexpr)
(def string
  "See [[protocols/string]]"
  prot/string)
(def children
  "See [[protocols/children]]"
  prot/children)
(def child-sexprs
  "See [[protocols/sexprs]]"
  prot/child-sexprs)
(def replace-children
  "See [[protocols/replace-children]]"
  prot/replace-children)
(def inner?
  "See [[protocols/inner?]]"
  prot/inner?)
(def printable-only?
  "See [[protocols/printable-only?]]"
  prot/printable-only?)
(def coerce
  "See [[protocols/coerce]]"
  prot/coerce)
(def length
  "See [[protocols/length]]"
  prot/length)


; *******************************
; see pez-rewrite-clj.node.forms
; *******************************
(def forms-node
  "see [[forms/forms-node]]"
  fm-node/forms-node)
(def keyword-node
  "see [[keyword/keyword-node]]"
  kw-node/keyword-node)


; *******************************
; see pez-rewrite-clj.node.seq
; *******************************
(def list-node
  "See [[seq/list-node]]"
  seq-node/list-node)
(def vector-node
  "See [[seq/vector-node]]"
  seq-node/vector-node)
(def set-node
  "See [[seq/set-node]]"
  seq-node/set-node)
(def map-node
  "See [[seq/map-node]]"
  seq-node/map-node)


; *******************************
; see pez-rewrite-clj.node.string
; *******************************
(def string-node
  "See [[stringz/string-node]]"
  s-node/string-node)



; *******************************
; see pez-rewrite-clj.node.comment
; *******************************
(def comment-node
  "See [[comment/comment-node]]"
  cmt-node/comment-node)
(def comment?
  "See [[comment/comment?]]"
  cmt-node/comment?)



; *******************************
; see pez-rewrite-clj.node.whitespace
; *******************************
(def whitespace-node
  "See [[whitespace/whitespace-node]]"
  ws-node/whitespace-node)
(def newline-node
  "See [[whitespace/newline-node]]"
  ws-node/newline-node)
(def spaces
  "See [[whitespace/spaces]]"
  ws-node/spaces)
(def newlines
  "See [[whitespace/newlines]]"
  ws-node/newlines)
(def whitespace?
  "See [[whitespace/whitespace?]]"
  ws-node/whitespace?)
(def linebreak?
  "See [[whitespace/linebreak?]]"
  ws-node/linebreak?)

(defn whitespace-or-comment?
  "Check whether the given node represents whitespace or comment."
  [node]
  (or (whitespace? node)
      (comment? node)))


; *******************************
; see pez-rewrite-clj.node.token
; *******************************
(def token-node
  "See [[token/token-node]]"
  tok-node/token-node)


; *******************************
; see pez-rewrite-clj.node.reader-macro
; *******************************
(def var-node
  "See [[reader-macro/var-node]]"
  rm-node/var-node)
(def eval-node
  "See [[reader-macro/eval-node]]"
  rm-node/eval-node)
(def reader-macro-node
  "See [[reader-macro/reader-macro-node]]"
  rm-node/reader-macro-node)
(def deref-node
  "See [[reader-macro/deref-node]]"
  rm-node/deref-node)


; *******************************
; see pez-rewrite-clj.node.quote
; *******************************
(def quote-node
  "See [[quote/quote-node]]"
  q-node/quote-node)
(def syntax-quote-node
  "See [[quote/syntax-quote-node]]"
  q-node/syntax-quote-node)
(def unquote-node
  "See [[quote/unquote-node]]"
  q-node/unquote-node)
(def unquote-splicing-node
  "See [[quote/unquote-splicing-node]]"
  q-node/unquote-splicing-node)


; *******************************
; see pez-rewrite-clj.node.uneval
; *******************************
(def uneval-node
  "See [[uneval/uneval-node]]"
  ue-node/uneval-node)


; *******************************
; see pez-rewrite-clj.node.meta
; *******************************
(def meta-node
  "See [[meta/meta-node]]"
  mt-node/meta-node)

; *******************************
; see pez-rewrite-clj.node.fn
; *******************************
(def fn-node
  "See [[fn/fn-node]]"
  f-node/fn-node)
