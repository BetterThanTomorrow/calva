(ns calva.docs.lint-test
  (:require [calva.docs.lint :as lint]
            [clojure.test :refer [deftest is testing]]))

(defn- page [src links & ids]
  {:page/src src
   :page/links links
   :page/headings (mapv #(hash-map :heading/id %) ids)
   :page/markdown ""
   :page/markdown-line 1})

(deftest site-problems
  (testing "links to missing pages and anchors"
    (is (= [{:problem/src "api.md" :problem/message "links to `gone.md`, and gone.md is not a page in the nav"}
            {:problem/src "api.md" :problem/message "links to `tao.md#nope`, and tao.md has no heading with the id `nope`"}
            {:problem/src "api.md" :problem/message "links to `#lost`, and api.md has no heading with the id `lost`"}]
           (lint/site-problems [(page "api.md" ["tao.md#why" "./tao.md" "#setup" "gone.md" "tao.md#nope" "#lost"
                                                "https://example.org/a.md" "images/a.png"]
                                      "setup")
                                (page "tao.md" [] "why")]))))
  (testing "block markup, by source line"
    (is (= [{:problem/src "tao.md" :problem/line 5 :problem/message "`!!! note` has no body indented four spaces"}]
           (lint/site-problems [(assoc (page "tao.md" []) :page/markdown "!!! note\n  Body" :page/markdown-line 5)])))))

(deftest problem-report
  (is (= "tao.md:5: a problem" (lint/problem-report {:problem/src "tao.md" :problem/line 5 :problem/message "a problem"})))
  (is (= "api.md: a problem" (lint/problem-report {:problem/src "api.md" :problem/message "a problem"}))))
