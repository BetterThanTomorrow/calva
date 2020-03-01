(comment
  
  #foo :bar
  (foo #foo (foo :bar))
  'abc #foo  @~#(foo :bar) \space
  \' {:foo (#foo '[1 2 3])} 'abc
  #foo
   'bar
  #foo
   #{:foo (#foo '[1 2 3])}
  \a [] "a"

  )