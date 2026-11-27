(ns hello-bb
  "Loaded and evaluated in the `bb` session by the Calva test protocol.")

(defn greet
  "Returns a greeting for `who`, naming the Babashka version."
  [who]
  (str "Hello, " who ", from Babashka " (System/getProperty "babashka.version") "!"))

(comment
  (greet "Calva")
  :rcf)
