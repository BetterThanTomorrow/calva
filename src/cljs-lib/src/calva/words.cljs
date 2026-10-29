(ns calva.words
  "How Calva finds words in Clojure text, in the extension and in the Output views.")

(def word-character
  "The characters of a word, as VS Code finds words in Clojure files with the `wordPattern` of
   `language-configuration.json`."
  #"[^\s,#()\[\]{}꞉;\"\\@]")
