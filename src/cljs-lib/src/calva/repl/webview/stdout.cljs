(ns calva.repl.webview.stdout
  "Stdout in the Output views, in blocks of a set size. Consecutive stdout of a category fills a block, and
   continues in blocks marked `data-continues`, which together are a run."
  (:require
   [calva.repl.webview.copy-button :as copy-button]))

(def stdout-chunk-size
  "How many characters a stdout block holds before its output continues in a new block."
  10000)

(defn element
  "Returns the hiccup of a stdout block of `category`, with its Copy output button before `text`. A block that
   `continues?` the stdout block before it is marked so."
  ([text category]
   (element text category false))
  ([text category continues?]
   [:pre (cond-> {:class ["output-stdout"] :data-output-element-type category}
           continues? (assoc :data-continues "true"))
    [copy-button/button {:class ["output-stdout-copy"]
                         :copy/label "Copy output"
                         :copy/actions [[:output/ax.copy-stdout :event/target]]}]
    text]))

(defn- chunk-end
  "Returns where to cut `text` for a chunk of at most `size` characters: after the last newline in it, and for
   a new block only when that newline is in the chunk's latter half, else at `size`. Text for the `room` of the
   last block is cut after its last newline, or not taken at all."
  [text size room?]
  (let [newline (if (pos? size) (.lastIndexOf text "\n" (dec size)) -1)]
    (cond
      room? (inc newline)
      (> newline (quot size 2)) (inc newline)
      ;; Not between the two halves of a surrogate pair
      (<= 0xD800 (.charCodeAt text (dec size)) 0xDBFF) (dec size)
      :else size)))

(defn stdout-chunks
  "Returns `text` split for stdout blocks: first the lines that fit the `room` left in the last block, maybe
   none, then parts of up to `stdout-chunk-size` characters, each cut after a newline when there is one in
   its latter half."
  [text room]
  (loop [text text
         size room
         chunks []]
    (if (<= (count text) size)
      (conj chunks text)
      (let [cut (chunk-end text size (empty? chunks))]
        (recur (subs text cut) stdout-chunk-size (conj chunks (subs text 0 cut)))))))

(defn stdout-run
  "Returns the stdout blocks of the run `block` is in: the block that starts it, and the blocks that continue it."
  [^js block]
  (let [continues? #(some-> ^js % (.hasAttribute "data-continues"))
        start (loop [^js b block]
                (if (continues? b) (recur (.-previousElementSibling b)) b))]
    (cons start (take-while continues? (rest (iterate #(.-nextElementSibling ^js %) start))))))

(defn run-text
  "Returns the text of the stdout run `block` is in."
  [^js block]
  (apply str (map #(.-textContent ^js %) (stdout-run block))))
