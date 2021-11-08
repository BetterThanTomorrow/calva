(ns pez.pirate-lang
  (:require [clojure.string :as string]))

(def english-o {:alphabet    "abcdefghijklmnopqrstuvwxyz"
                :vowels      "aeiou"
                :pirate-char "o"})

(defn- configure
  [{:keys [alphabet vowels pirate-char]}]
  (let [alphabet   (set (seq (string/upper-case alphabet)))
        vowels     (set (seq (string/upper-case vowels)))
        consonants (set (remove vowels alphabet))
        pirates    (if (vowels pirate-char)
                     vowels
                     consonants)]
    {:pirate-char pirate-char
     :pirates pirates}))

(defn component []
  (html)
  [:div {:style ^:foo {:foo :bar} {:background "#FFF"
                                   :color "#000"}}]
  [:h1 "title"])

(defn foo [a b]
  (let [x (+ a b)]
       (println "sum is" x)))

(defn to-pirate-talk
  [text language]
  (let [{:keys [pirate-char pirates]} (configure language)]
    (apply str (mapcat (fn [c]
                         (if (pirates (first (string/upper-case c)))
                           (interpose pirate-char (repeat 2 c))
                           [c]))
                       text))))

(defn from-pirate-talk
  [text language]
  (let [{:keys [pirate-char pirates]} (configure language)
        pattern (re-pattern (str "(?i)([" (apply str pirates) "])" pirate-char "\\1"))]
    (string/replace text pattern "$1")))

(comment
  (to-pirate-talk "Have you heard about Pirate talk?" english-o)
  ;; => "HoHavove yoyou hohearordod aboboutot PoPiroratote totalolkok?"

  (from-pirate-talk "HoHavove yoyou hohearordod aboboutot PoPiroratote totalolkok?" english-o)
  ;; => "Have you heard about Pirate talk?"
  ,)