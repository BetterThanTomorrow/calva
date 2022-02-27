(comment
  @(rf/subscribe [:foo]))

#aa aaa bbb

^aa aaa bbb

^:aa aaa bbb

^:a #a a b

#a ^:a a b

^{:aa aa} aaa bbb

^{:aa aa} #aa aaa bbb

#aa (def foo
      bar)
bbb

^aa (def foo
      bar)
bbb

^:aa (def foo
       bar)
bbb

^{:aa aa} (def foo
            bar)
bbb

^{:aa aa} #aa (def foo
                bar)
bbb

#aa ^{:aa aa} (def foo
                bar)
bbb

#a #b a

#_(def foo
    bar)

(defn test-reader [_ form]
  {:meta (meta form)
   :form form})

(set! *default-data-reader-fn* test-reader)

(c
 #f
  (#b
    [:f :b :z])
 #x
  #y
   1)