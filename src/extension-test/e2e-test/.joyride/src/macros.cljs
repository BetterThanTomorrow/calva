(ns macros)

(defmacro deftest-async [name opts & body]
  (let [[opts body]
        (if (map? opts)
          [opts body]
          [nil (cons opts body)])]
    `(cljs.test/deftest ~name
       ~@(when-let [pre (:before opts)]
           [pre])
       (cljs.test/async
        ~'done
        (-> (do ~@body)
            (.catch (fn [err#]
                      (cljs.test/is (= 1 0) (str err# (.-stack err#)))))
            (.finally
             (fn []
               ~@(when-let [post (:after opts)]
                   [post])
               (~'done))))))))