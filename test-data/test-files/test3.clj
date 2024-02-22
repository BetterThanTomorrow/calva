(let [#_#_x (get c :x "x")
      y (get c :y "y")
      #_#_z (get c :z "z")
      å {:ä :ö}]
  (str y å #_#_x z))