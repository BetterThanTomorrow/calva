(def colt-express
  {:name "Colt Express"
   :categories ["Family"
                "Strategy"]
   :play-time 40
   :ratings {:pez 5.0
             :kat 5.0
             :wiw 5.0
             :vig 3.0
             :rex 5.0
             :lun 4.0}})

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

(reg-event-fx
 ::foo
 (fn []
   (let [foo (-> bar baz)]) ; slurp was broken here
   (prn foo bar)
   {:fx [[:dispatch [:nav :bar]]]}))

(defn component []
  (html
   [:div {:style ^:foo {:foo :bar} {:background "#FFF"
                                    :color "#000"}}]
   [:h1 "title"]))

(defn foo [a b]
  (let [x + a b]
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