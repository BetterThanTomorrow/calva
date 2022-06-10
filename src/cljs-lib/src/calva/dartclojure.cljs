(ns calva.dartclojure
  (:require [dumch.convert :as dart->clj]))

(defn convert [dart-string]
  (try
    {:result
     (dart->clj/convert dart-string :string :sexpr)}
    (catch :default e
      {:error {:message "Error parsing Dart code"
               :exception {:name (.-name e)
                           :message (.-message e)}}})))

(defn convert-bridge [dart-string]
  (convert dart-string))

(comment
  (convert
   "
    (context, index) {
      if (index == 0) {
        return const Padding(
          padding: EdgeInsets.only(left: 15, top: 16, bottom: 8),
          child: Text(
            'You might also like:',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w500,
            ),
          ),
        );
      }
      return const SongPlaceholderTile();
    };
    "))