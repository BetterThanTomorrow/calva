(ns top-level
  (:gen-class))

(defn -main
  "I don't do a whole lot ... yet."
  {:rfc (comment
          (bar :baz)
          
          (foo [] 
                 bar
               ))}
  [& _args]
  (println "Hello, World!"))

(comment
  (-main)

  (foo [] 
                 bar
               ))

(hej
 (bar :baz)

 (foo [] 
                 bar
               ))

(foo []) (bar :baz)

      (foo []
     bar)