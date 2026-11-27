(ns hello-clj
  "Loaded and evaluated in the `clj` session by the Calva test protocol.")

(defn greet
  "Returns a greeting for `who`, naming the Clojure version."
  [who]
  (str "Hello, " who ", from Clojure " (clojure-version) "!"))

(comment
  (greet "Calva")
  :rcf)
