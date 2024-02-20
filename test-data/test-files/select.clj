(comment
  @(rf/subscribe [:foo]))

#aa aaa bbb

^aa aaa bbb

^:aa aaa bbb

^:a #a a b

b aaa bbb ^{:aa aa}

#a ^:a a

a

^{:aa aa} #aa aaa bbb

bbb
#aa (def foo
      bar)

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



^{:a b}
#c
 ^d
 "foo"  


  ()



   #{a b}