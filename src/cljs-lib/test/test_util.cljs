(ns test-util)

(defn wrap-spy
  "This is a helper that returns a function that calls the spy (created by the tortue/spy library),
   so that the shadow-cljs doesn't complain, which is does if a spy is used and called directly in a test - it will say
   the thing is not a function.
   See:
   - https://github.com/alexanderjamesking/spy/issues/29
   - https://clojurescript.org/reference/compiler-options#static-fns

   (Setting static-fns to false in the build config's compiler-options doesn't fully fix the issue.)"
  [spy]
  (fn [& args]
    (apply spy args)))
