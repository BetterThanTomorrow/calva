(ns calva.js2cljs.converter
  (:require [js-cljs.core :as jsc]))

(defn convert [js-string]
  (let [debug (atom nil)]
    (try
      {:result
       (jsc/parse-str js-string {:zprint-opts {:style [:community]
                                               :parse {:interpose "\n\n"}
                                               :width 60
                                               :pair {:nl-separator? true}}
                                 :format-opts {:debug debug}})}
      (catch :default e
        {:error {:message "Error parsing JS file"
                 :number-of-parsed-lines (count (.split (subs js-string 0 (:start @debug)) "\n"))
                 :exception {:name (.-name e)
                             :message (.-message e)}}}))))

(defn convert-bridge [js-string]
  (convert js-string))

(comment
  (convert "var MongoClient = require('mongodb').MongoClient;
var url = \"mongodb://localhost:27017/mydb\";

MongoClient.connect(url, function(err, db) {
  if (err) throw err;
  console.log(\"Database created!\");
  db.close();
});")

  (convert "foo;
            bar;
            import * as foo from 'foo'")

  (jsc/parse-str "a++")

  (println (jsc/parse-str "
      const sdk = new ChartsEmbedSDK({
        baseUrl: 'https://charts.mongodb.com/charts-mongodb-gtywi'
      });

      const chart = sdk.createChart({ chartId: '7f535ee7-2074-4350-9f94-237277b94391' }); 
      chart.render(document.getElementById('chart'));
" {:zprint-opts {:style [:community]
                 :parse {:interpose "\n\n"}
                 :width 60
                 :pair {:nl-separator? true}}
   :format-opts {:debug (atom nil)}}))
  )