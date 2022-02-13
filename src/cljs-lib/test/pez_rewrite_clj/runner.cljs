(ns pez-rewrite-clj.runner
  (:require [doo.runner :refer-macros [doo-tests]]
            [pez-rewrite-clj.zip-test]
            [pez-rewrite-clj.paredit-test]
            [pez-rewrite-clj.node-test]
            [pez-rewrite-clj.zip.seqz-test]
            [pez-rewrite-clj.zip.findz-test]
            [pez-rewrite-clj.zip.editz-test]))

(doo-tests 'pez-rewrite-clj.zip-test
           'pez-rewrite-clj.paredit-test
           'pez-rewrite-clj.node-test
           'pez-rewrite-clj.zip.seqz-test
           'pez-rewrite-clj.zip.findz-test
           'pez-rewrite-clj.zip.editz-test)
