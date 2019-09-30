(ns ^{:doc "A simple nREPL proxy server that logs all communication between nREPL server and client.

Use:

  clj nrepl_proxy.clj <proxy-port> <app-nrepl-port>

All packets sent to/read from <proxy-port> would be

1. Logged on screen
2. Transparently forwarder to <app-nrepl-port>"}
  nrepl-proxy
  (:require
    [clojure.string :as str])
  (:import
    [java.io InputStream PushbackInputStream OutputStream BufferedOutputStream]
    [java.net ServerSocket Socket]
    [java.util Arrays]))


(set! *warn-on-reflection* true)


(defn read-until [^InputStream in ch]
  (loop [buf ^bytes (make-array Byte/TYPE 1024)
         len 0]
    (let [b (.read in)]
      (cond
        (< b 0) ;; EOS
        (String. buf 0 len)

        (= (int ch) b) ;; FOUND
        (String. buf 0 len)

        :else ;; KEEP READING
        (if (< len (alength buf))
          (do
            (aset buf len (byte b))
            (recur buf (inc len)))
          (let [buf' (Arrays/copyOf buf (* len 2))]
            (aset buf' len (byte b))
            (recur buf' (inc len))))))))


(defn read-exactly [^InputStream in ^long len]
  (loop [buf ^bytes (make-array Byte/TYPE len)
         pos 0]
    (let [read (.read in buf pos (- len pos))]
      (cond
        (<= read 0)
        (String. buf 0 pos)

        (>= (+ pos read) len)
        (String. buf 0 len)

        :else
        (recur buf (+ pos read))))))


(defn bencode-read [^PushbackInputStream in]
  (let [b (.read in)]
    (cond
      (< b 0)
      nil

      ;; int "i...e"
      (= \i (char b))
      (Long/parseLong (read-until in \e))

      ;; string "[0-9]+:..."
      (<= (byte \0) b (byte \9))
      (let [_   (.unread in b)
            len (Long/parseLong (read-until in \:))]
        (read-exactly in len))

      ;; list "l...e"
      (= \l (char b))
      (loop [acc []]
        (let [e (.read in)]
          (cond
            (< e 0)         acc
            (= \e (char e)) acc
            :else
            (let [_ (.unread in e)
                  v (bencode-read in)]
              (recur (conj acc v))))))

      ;; dict "d...e"
      (= \d (char b))
      (loop [acc {}]
        (let [e (.read in)]
          (cond
            (< e 0)         acc
            (= \e (char e)) acc
            :else
            (let [_ (.unread in e)
                  k (bencode-read in) 
                  v (bencode-read in)]
              (recur (assoc acc k v)))))))))


(defn bencode-write [^OutputStream out obj]
  (cond
    (map? obj)
    (do
      (.write out (int \d))
      (doseq [[k v] obj]
        (bencode-write out k)
        (bencode-write out v))
      (.write out (int \e)))
    
    (sequential? obj)
    (do
      (.write out (int \l))
      (doseq [v obj]
        (bencode-write out v))
      (.write out (int \e)))

    (string? obj)
    (let [bytes (.getBytes ^String obj "UTF-8")]
      (.write out (.getBytes (str (alength bytes))))
      (.write out (int \:))
      (.write out bytes))
    
    (int? obj)
    (do
      (.write out (int \i))
      (.write out (.getBytes (str obj)))
      (.write out (int \e)))))


(defn print-op [dir m]
  (println dir "{"
    (str/join "\n    "
      (for [[k v] m]
        (str k " " (pr-str v))))
    "}"))


(defmacro thread [& body]
  `(doto
     (Thread. (fn [] (try ~@body (catch Exception e# (.printStackTrace e#)))))
     (.start)))


(defn copy! [^String direction ^InputStream in ^OutputStream out]
  (try
    (let [in  (PushbackInputStream. in 1)
          out (BufferedOutputStream. out 10240)]
      (loop []
        (when-some [msg (bencode-read in)]
          (print-op direction msg)
          (bencode-write out msg)
          (.flush out)
          (recur))))
    (println direction "CLOSE")
    (catch Exception e
      (if (= "Socket closed" (.getMessage e))
        (println direction "CLOSED")
        (throw e)))))


(defn proxy! [^Socket client-socket ^long app-port]
  (let [app-socket (Socket. "localhost" app-port)
        client> (.getInputStream client-socket)
        client< (.getOutputStream client-socket)
        <app    (.getInputStream app-socket)
        >app    (.getOutputStream app-socket)]
    (thread
      (copy! ">" client> >app)
      (.close app-socket))
    (thread
      (copy! "<" <app client<)
      (.close client-socket))))


(defn start! [proxy-port app-port]
  (println "[ PROXY ] Connections to" proxy-port "would be logged and forwarded to" app-port)
  (let [server-socket (ServerSocket. proxy-port)]
    (loop []
      (let [socket (.accept server-socket)]
        (println "> ACCEPT" (.getPort socket))
        (thread
          (proxy! socket app-port)))
      (recur))))


(defn -main [& [proxy-port app-port]]
  (when (or (nil? proxy-port)
            (nil? app-port)
            (not (re-matches #"\d+" proxy-port))
            (not (re-matches #"\d+" app-port)))
    (println "Use `clj nrepl_proxy.clj <proxy-port> <app-nrepl-port>`")
    (System/exit 1))
  (start! (Long/parseLong proxy-port) (Long/parseLong app-port)))


(apply -main *command-line-args*)