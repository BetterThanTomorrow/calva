(ns top-level)

(defn -main
  "I don't do a whole lot ... yet."
  {:rfc (comment
          ; I want to alt+enter eval this println
          (println "Nested RFC"))}
  [& _args]
  (println "Hello, World!"))

(comment
  (-main))