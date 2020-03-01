(comment
  
  #foo :bar
  (foo #foo (foo :bar))
  #_#_
  'abc #foo  @~#(foo :bar) \space
  \' {:foo (#foo '[1 2 3])} 'abc
  #_#_
  #foo
   'bar
  #foo
   #{:foo (#foo '[1 2 3])}
  \a [] "a"

  )