(comment "date / time formatter using java" 

         (.format
          (java.text.SimpleDateFormat.
           "MMMM"
           (new java.util.Locale "nl", "NL"))
          (.parse
           (java.text.SimpleDateFormat.
            "yyyy-MM-dd")
           "2022-07-01")) ; => "juli"

         (let [df (java.time.format.DateTimeFormatter/ofPattern "MMMM" (new java.util.Locale "nl", "NL"))
               date (java.time.LocalDate/now)]
           (.format df date)) ; => "september"

         "getLocale is an instance method, so you call it on an instance of DateTimeFormatter ! <3 Borkdude"
         (let [df (java.time.format.DateTimeFormatter/ofPattern "MMMM" (new java.util.Locale "nl", "NL"))]
           (.getLocale df)) ; => #object [java.util.Locale 0x3bcff53 "nl_NL"]
         (let [df (java.time.format.DateTimeFormatter/ofPattern "MMMM")]
           (.getLocale df)) ; => #object [java.util.Locale 0x4c43d349 "en_NL"]

         "Java"
         (java.time.format.DateTimeFormatter/ofPattern "MMMM" (new java.util.Locale "nl", "NL")) ;=> "Text(MonthOfYear)"
         (java.time.format.DateTimeFormatter/ofPattern "yyyy-MM-dd'T'HH:mm:ss" (new java.util.Locale "nl", "NL")) ;=> "Value(YearOfEra,4,19,EXCEEDS_PAD)'-'Value(MonthOfYear,2)'-'Value(DayOfMonth,2)'T'Value(HourOfDay,2)':'Value(MinuteOfHour,2)':'Value(SecondOfMinute,2)"
         "java-time.api" ; NOTE - jt/formatter does not (yet) support Locale formatting
         (java-time.api/formatter "MMMM") ;=> "ParseCaseSensitive(true)Text(MonthOfYear)"
         (java-time.api/formatter "yyyy-MM-dd'T'HH:mm:ss") ;=> "ParseCaseSensitive(true)Value(YearOfEra,4,19,EXCEEDS_PAD)'-'Value(MonthOfYear,2)'-'Value(DayOfMonth,2)'T'Value(HourOfDay,2)':'Value(MinuteOfHour,2)':'Value(SecondOfMinute,2)"
         "java-time.api with Java.Locale formatter for monthname"
         (java-time.api/format
          (java.time.format.DateTimeFormatter/ofPattern "MMMM" (new java.util.Locale "nl", "NL"))
          (java-time.api/local-date-time))

         (import 'java.time.Instant)
         (import 'java.time.LocalTime)
         (import 'java.time.LocalDate)
         (import 'java.time.LocalDateTime)
         (import 'java.time.ZoneId)
         (import 'java.time.ZoneOffset)
         (import 'java.sql.Time)
         (import 'java.sql.Timestamp)

         "ZoneId"
         (java.time.ZoneId/systemDefault) ;=> #object [java.time.ZoneRegion 0x11f83d2f "Europe/Berlin"]
         "ZoneOffset"
         (ZoneOffset/UTC) ;=? #object [java.time.ZoneOffset 0x5003df96 "Z"]
         (ZoneOffset/ofOffset "UTC" (ZoneOffset/UTC)) ;=> #object [java.time.ZoneRegion 0x43bc901d "UTC"]

         (let [now  (java.time.LocalDateTime/now) ;=> #object [java.time.LocalDateTime 0x3770e19f "2023-01-21T15:10:04.063386"]
               zone (java.time.ZoneId/of "Europe/Berlin") ;=> #object [java.time.ZoneRegion 0x414216a4 "Europe/Berlin"]
               zoneOffSet (.getOffset (.getRules zone) now)] ;=> #object [java.time.ZoneOffset 0x271173ce "+01:00"]
           (.toInstant now))

         "EPOCH"
         (System/currentTimeMillis) ;=> 1674308753156
         (java.time.Instant/EPOCH) ;=> #object [java.time.Instant 0x18a39103 "2023-01-21T13:47:21.806Z"]
         (java.time.Instant/ofEpochMilli (System/currentTimeMillis)) ;=> #object [java.time.Instant 0x682ba738 "2023-01-21T13:48:03.568Z"]
         (java.time.ZoneId/systemDefault) ;=> #object [java.time.ZoneRegion 0x11f83d2f "Europe/Berlin"]
         "FROM INSTANT"
         (java.time.LocalDateTime/ofInstant ;=> #object [java.time.LocalDateTime 0x2013d890 "2023-01-21T14:52:35.007"]
          (java.time.Instant/ofEpochMilli
           (System/currentTimeMillis))
          (java.time.ZoneId/systemDefault))
         "TO INSTANT FROM LOCALDATE / LOCALTIME / LOCALDATETIME"
         (let [now-date (java.time.LocalDate/now)
               now-time (java.time.LocalTime/now)
               zone (java.time.ZoneId/of "Europe/Berlin")
               now-date-time (java.time.LocalDateTime/of now-date now-time)
               offset (.getOffset (.getRules zone) now-date-time)
               instant (.toInstant now-date-time offset)]
           instant) ;=> #object [java.time.Instant 0x739d2031 "2023-01-21T15:05:34.638332800Z"]
         (let [zone (java.time.ZoneId/of "Europe/Berlin")
               now-date-time (java.time.LocalDateTime/now)
               offset (.getOffset (.getRules zone) now-date-time)
               instant (.toInstant now-date-time offset)]
           now-date-time) ;=> #object [java.time.LocalDateTime 0x69c1cad6 "2023-01-21T16:06:56.599377500"]
         "TO INSTANT FROM STRING"
         ; Instant string
         (.toEpochMilli (java.time.Instant/parse "2018-11-30T18:35:24.00Z")) ;=> 1543602924000
         ; Time string
         (let [time "15:20"
               tf  (java.time.format.DateTimeFormatter/ofPattern "HH:mm" (new java.util.Locale "nl", "NL"))
               tf2 (java.time.format.DateTimeFormatter/ofPattern "hh.mma" (new java.util.Locale "en", "US"))
               tf3 (java.time.format.DateTimeFormatter/ofPattern "hh.mma" (new java.util.Locale "en", "UK"))
               parsed (.parse tf time) ;=> #object [java.time.format.Parsed 0x18201ff8 "{},ISO resolved to 15:20"]
               local-time (java.time.LocalTime/parse time tf) ;=> #object [java.time.LocalTime 0x24f9df8e "15:20"]
               local-date-time (java.time.LocalDateTime/of (java.time.LocalDate/now) local-time) ;=> #object [java.time.LocalDateTime 0x11c090ea "2023-01-21T15:20"]
               zone (java.time.ZoneId/of "Europe/Berlin") ;=> #object [java.time.ZoneRegion 0x4d19d61f "Europe/Berlin"]
               offset (.getOffset (.getRules zone) local-date-time) ;=> #object [java.time.ZoneOffset 0x271173ce "+01:00"]
               instant (.toInstant local-date-time offset) ;=> #object [java.time.Instant 0x4acfc521 "2023-01-21T14:20:00Z"]
               mills-long-way-around (.toEpochMilli instant) ;=> 1674310800000
               at-zone (.atZone local-date-time zone) ;=> [java.time.ZonedDateTime 0x6bf2fed3 "2023-01-21T15:20+01:00[Europe/Berlin]"]
               instant-quicker (.toInstant at-zone) ;=> #object [java.time.Instant 0x68280eca "2023-01-21T14:20:00Z"]
               millis-quicker (.toEpochMilli instant-quicker) ;=> 1674310800000
               ]
           offset)

         "FROM EPOCH"
         (java.time.LocalDateTime/ofInstant
          (java.time.Instant/ofEpochMilli
           (+ (System/currentTimeMillis) 7261685))
          (java.time.ZoneId/systemDefault))
         "TO EPOCH - FROM INSTANT"
         (.toEpochMilli (java.time.Instant/now)) ;=> 1674311974086
         (let [zone (java.time.ZoneId/of "Europe/Berlin")
               now (java.time.LocalDateTime/now)
               offset (.getOffset (.getRules zone) now)
               instant (.toInstant now offset)]
           (.toEpochMilli instant))
         "TO EPOCH SECOND - FROM TIME"
         (let [date (java.time.LocalDate/parse "2018-12-29")
               time (java.time.LocalTime/parse "20:12:32")
               zone (java.time.ZoneOffset/of "Z") ; Z is UTC or can be an offset of +n or -n etc
               value (.toEpochSecond time date zone)]
           (println "LocalDate: " date)
           (println "ZoneOffset: " zone)
           (println "Epoch Second: " value))
         (let [zone (java.time.ZoneId/of "Europe/Berlin")
               now-date-time (java.time.LocalDateTime/now)
               offset (.getOffset (.getRules zone) now-date-time)
               epoch-seconds (.toEpochSecond now-date-time offset)]
           epoch-seconds)
         (let [zone (java.time.ZoneId/systemDefault)
               now-date-time (java.time.LocalDateTime/now)
               offset (.getOffset (.getRules zone) now-date-time)
               epoch-seconds (.toEpochSecond now-date-time offset)]
           epoch-seconds)
         "TO EPOCH SECONDS - FROM STRING"
         (let [time "23:30"
               today (java.time.LocalDate/now)
               zone  (java.time.ZoneId/systemDefault)
               formatter (java.time.format.DateTimeFormatter/ofPattern "HH:mm" (new java.util.Locale "nl", "NL"))
               local-time (java.time.LocalTime/parse time formatter)
               date-time (java.time.LocalDateTime/of today local-time)
               offset (.getOffset (.getRules zone) date-time)
               epoch-seconds (.toEpochSecond date-time offset)]
           epoch-seconds)
         "TO EPOCH MILLIS - FROM STRING"
         (let [time "23:30"
               today (java.time.LocalDate/now)
               zone  (java.time.ZoneId/systemDefault)
               formatter (java.time.format.DateTimeFormatter/ofPattern "HH:mm" (new java.util.Locale "nl", "NL"))
               local-time (java.time.LocalTime/parse time formatter)
               date-time (java.time.LocalDateTime/of today local-time)
               at-zone (.atZone date-time zone)
               instant (.toInstant at-zone)]
           (.toEpochMilli instant))
         "TO EPOCH MILLIS - FOR AT-AT SCHEDULING"
         (let [time "23:30"
               today (java.time.LocalDate/now)
               zone  (java.time.ZoneId/systemDefault)
               formatter (java.time.format.DateTimeFormatter/ofPattern "HH:mm" (new java.util.Locale "nl", "NL"))
               local-time (java.time.LocalTime/parse time formatter)
               date-time (java.time.LocalDateTime/of today local-time)
               at-zone (.atZone date-time zone)
               instant (.toInstant at-zone)
               millis-at (.toEpochMilli instant)]
           (- millis-at (System/currentTimeMillis))) ;=> 23981238
         ;"TO EPOCH MILLIS - FOR AT-AT SCHEDULING"
         #_(let [time "23:30"
               today (java.time.LocalDate/now)
               zone  (java.time.ZoneId/systemDefault)
               formatter (java.time.format.DateTimeFormatter/ofPattern "HH:mm" (new java.util.Locale "nl", "NL"))
               local-time (java.time.LocalTime/parse time formatter)
               date-time (java.time.LocalDateTime/of today local-time)
               java-date (java.util.Date/ date-time zone)
               ;instant (.toInstant at-zone)
               ;millis-at (.toEpochMilli instant)
               ]
           (.getTime at-zone)
           ) ;=> 23981238

         "FROM JAVA.TIME.* TO STRING"
         (let [tf (java.time.format.DateTimeFormatter/ofPattern "HH:mm" (new java.util.Locale "nl", "NL"))
               time (java.time.LocalTime/now)]
           (.format time tf))
         "FROM STRING TO JAVA.TIME.*" ; https://stackoverflow.com/a/54511526/12296723
         (let [tf  (java.time.format.DateTimeFormatter/ofPattern "HH:mm" (new java.util.Locale "nl", "NL"))
               tf2 (java.time.format.DateTimeFormatter/ofPattern "hh.mma" (new java.util.Locale "en", "US"))
               tf3 (java.time.format.DateTimeFormatter/ofPattern "hh.mma" (new java.util.Locale "en", "UK"))]
           (.parse tf "15:20") ;=> #object [java.time.format.Parsed 0x1ae126d9 "{},ISO resolved to 15:20"]
           (java.time.LocalTime/parse "15:20" tf) ;=> #object [java.time.LocalTime 0x7a27895d "15:20"]
           (java.time.LocalDateTime/of (java.time.LocalDate/now) (java.time.LocalTime/parse "15:20" tf)) ;=> #object [java.time.LocalDateTime 0x4665c38a "2023-01-21T15:20"]
           (.parse tf2 "11.20PM") ;=> #object [java.time.format.Parsed 0x4a941890 "{},ISO resolved to 23:20"]
           (.parse tf3 "11.20PM") ;=> #object [java.time.format.Parsed 0x4a941890 "{},ISO resolved to 23:20"]
           )

         "FROM SQL TIME TO LOCALTIME TO LOCALDATETIME TO EPOCH"
         (.toEpochMilli (java-time.api/instant (java-time.api/local-date-time (java-time.api/local-date) (java-time.api/local-time (java.sql.Time/valueOf (java.time.LocalTime/MAX)))) "Europe/Berlin"))
         ; or
         (java-time.convert/to-millis-from-epoch (java-time.api/instant (java-time.api/local-date-time (java-time.api/local-date) (java-time.api/local-time (java.sql.Time/valueOf (java.time.LocalTime/MAX)))) "Europe/Berlin"))
         ; or
         (let [sqltime (java.sql.Time/valueOf (java.time.LocalTime/MAX))]
           (-> sqltime
               (.toLocalTime)
               (java.time.LocalTime/from)
               (overtone.at-at.util/from-local-time :after false)))

         "FROM SQL TIME TO LOCALDATETIME TO EPOCH"
         (.toEpochMilli (java-time.api/instant (java-time.api/local-date-time (java-time.api/local-date) (java-time.api/local-time (java.sql.Time/valueOf (java.time.LocalTime/MAX)))) "Europe/Berlin"))
         ; or
         (java-time.convert/to-millis-from-epoch (java-time.api/instant (java-time.api/local-date-time (java-time.api/local-date) (java-time.api/local-time (java.sql.Time/valueOf (java.time.LocalTime/MAX)))) "Europe/Berlin"))
         ; or
         (let [sqltime (java.sql.Time/valueOf (java.time.LocalTime/MAX))]
           (-> sqltime
               (.toLocalTime)
               (java.time.LocalTime/from)
               (overtone.at-at.util/from-local-time :after false)))

         )

(comment "link: https://github.com/dm3/clojure.java-time")

(comment "Repl tips"

         (require '[java-time.repl])
         (java-time.repl/show-adjusters)
         (java-time.repl/show-fields)
         (java-time.repl/show-formatters)
         (java-time.repl/show-graph)
         (java-time.repl/show-path)
         (java-time.repl/show-timezones)
         (java-time.repl/show-units)

         )

(comment "Examples"

         (java-time.api/local-date) ;=> #object [java.time.LocalDate 0x7819a16f "2022-12-02"]
         (java-time.api/local-date-time) ;=> #object [java.time.LocalDateTime 0x49dc85f "2022-12-02T11:00:11.238685200"]
         (.toString (java-time.api/local-date-time)) ;=> "2022-12-02T11:00:24.081884900"
         (str (java-time.api/local-date-time)) ;=> "2022-12-02T11:03:33.027666900"
         (java-time.api/zoned-date-time (java-time.api/local-date-time) "Europe/Amsterdam") ;=> #object [java.time.ZonedDateTime 0x14514154 "2023-01-12T09:03:59.397911700+01:00[Europe/Amsterdam]"]

         "Format a date:"
         (java-time.api/format "MM/dd" (java-time.api/zoned-date-time 2015 9 28)) ;=> "09/28"
         (java-time.api/format "yyyy-MM-dd HH:mm" (java-time.api/local-date-time)) ;=> "2022-12-02 11:12"
         (clojure.string/join "T" (clojure.string/split (java-time.api/format "yyyy-MM-dd HH:mm" (java-time.api/local-date-time)) #" ")) ;=> "2022-12-02T11:12"
         (java-time.api/format "yyyy-MM-dd'T'HH:mm:ss" (java-time.api/local-date-time (java-time.api/sql-timestamp))) ;=> "2022-12-348T08:12:41"

         "Truncating a date:"
         (java-time.api/truncate-to (java-time.api/local-date-time 2015 9 28 10 15) :days) ;=> #object [java.time.LocalDateTime 0x307023cd "2015-09-28T00:00"]
         (java-time.api/truncate-to (java-time.api/local-date-time) :minutes) ;=> #object [java.time.LocalDateTime 0x553be809 "2022-12-02T11:27"]
         (.toString (java-time.api/truncate-to (java-time.api/local-date-time) :minutes)) ;=> "2022-12-02T11:28"

         "Format a date and time:"
         (java-time.api/format "yyyy-MM-ddHH:mm:ss" (java-time.api/zoned-date-time 2015 9 28)) ;=> "2015-09-2800:09:00"
         (java-time.api/format "yyyy-MM-ddHH:mm:ss" (java-time.api/local-date-time)) ;=> "2022-12-0211:12:17"
         (java-time.api/format :rfc-1123-date-time (java-time.api/local-date-time)) ;=> "2022-12-02T11:09:04.7744316"
         (java-time.api/local-date-time "yyyy-MM-dd HH:mm") ; DOES NOT WORK
         (java-time.api/as (java-time.api/local-date-time) :year :month-of-year :day-of-month :hour-of-day :minute-of-day)

         "Formate a date and time using the formatter function:"
         (java-time.api/format (java-time.api/formatter "yyyy-MM-dd'T'HH:mm:ss") (java-time.api/local-date-time)) ;=> "2022-12-14T09:27:52"
         (java-time.api/format (java-time.api/formatter "yyyy-MM-dd") (java-time.api/local-date-time)) ;=> "2022-12-14"

         "Parse a date:"
         (java-time.api/local-date "MM/yyyy/dd" "09/2015/28") ;=> #object[java.time.LocalDate "2015-09-28"]
         (java-time.api/local-date-time "yyyy-MM-dd'T'HH:mm:ss" "2022-12-14T09:27:52") ;=> #object [java.time.LocalDateTime 0x11319b82 "2022-12-14T09:27:52"]

         "Create a java.time.Instant"
         (java-time.api/instant "1974-07-27T00:00:00Z") ;=> #object [java.time.Instant 0x18585a6e "1974-07-27T00:00:00Z"]
         (java-time.api/instant (* 1671034085 1000)) ;=> (epoch time in ms) #object [java.time.Instant 0x7a5e0f8f "2022-12-14T16:08:05Z"]
         "Parse a java.time.Instant"
         (java-time.api/local-date-time (java-time.api/instant "1974-07-27T00:00:00Z") "UTC+2") ;=> #object [java.time.LocalDateTime 0x4cfe22f7 "1974-07-27T02:00"]
         (java-time.api/local-date-time (java-time.api/instant (* 1671034085 1000)) "Europe/Amsterdam") ;=> #object [java.time.LocalDateTime 0x381d4b15 "2022-12-14T17:08:05"]
         (java-time.api/local-date-time
          (java-time.api/zoned-date-time ;=> #object [java.time.ZonedDateTime 0x388e9e9c "2022-12-14T17:08:05+01:00[Europe/Amsterdam]"]
           (java-time.api/instant (* 1671034085 1000))
           "Europe/Amsterdam")) ;=> #object [java.time.LocalDateTime 0x7d785355 "2022-12-14T17:08:05"]
         (java-time.api/local-date-time
          (java-time.api/zoned-date-time ;=> #object [java.time.ZonedDateTime 0x77542747 "2022-12-14T18:08:05+02:00[UTC+02:00]"]
           (java-time.api/instant (* 1671034085 1000))
           "UTC+2")) ;=> #object [java.time.LocalDateTime 0x3d6097c4 "2022-12-14T18:08:05"]

         )

(comment "clj-time => java-time conversion"

         "OLD: Time/now"
         (clj-time.core/now) ;=> #clj-time/date-time "2022-12-14T08:46:16.819Z"
         "NEW: Time/now"
         (java-time.api/local-date-time) ;=> #object [java.time.LocalDateTime 0x540a6e5c "2022-12-14T09:46:32.625554800"]

         "OLD: to SQL DateTime"
         (-> (clj-time.core/now) (redacted.common.sql/to-utc-sql-time)) ;=> java.sql.Timestamp #inst "2022-12-14T07:31:05.872000000-00:00"
         "NEW: to SQL DateTime"
         (java-time.api/sql-timestamp) ;=> java.sql.Timestamp #inst "2022-12-14T07:31:05.872000000-00:00"
         (java-time.api/sql-timestamp (java-time.api/local-date-time)) ;=> java.sql.Timestamp #inst "2022-12-14T09:25:58.785914300-00:00"

         "OLD: from SQL DateTime"
         (redacted.common.sql/from-utc-sql-time (-> (clj-time.core/now) (redacted.common.sql/to-utc-sql-time))) ;=> #clj-time/date-time "2022-12-14T08:49:45.342Z"
         "NEW: from SQL DateTime"
         (java-time.api/local-date-time (java-time.api/sql-timestamp)) ;=> #object [java.time.LocalDateTime 0x1e79ef82 "2022-12-14T09:50:35.237172600"]

         "OLD: XML formatted DateTime"
         (redacted.common.xml/format-date-time (clj-time.core/now)) ;=> java.lang.String "2022-12-14T08:34:37"
         "NEW: XML formatted DateTime"
         (java-time.api/format "YYYY-MM-dd'T'HH:mm:ss" (java-time.api/local-date-time (java-time.api/sql-timestamp))) ;=> java.lang.String "2022-12-14T09:27:20"

         "OLD: Coerce a datetime string to a date - 1974-07-27T00:00:00Z -> 1974-07-27"
         (clj-time.coerce/to-date-time "1974-07-27T00:00:00Z") ;=> org.joda.time.DateTime #clj-time/date-time "1974-07-27T00:00:00.000Z"
         (redacted.common.xml/format-date (clj-time.coerce/to-date-time "1974-07-27T00:00:00Z")) ;=> "1974-07-27"
         "NEW: Coerce a datetime string to a date - 1974-07-27T00:00:00Z -> 1974-07-27"
         "Possibility 1 - shortest"
         (java-time.api/format ;=> "1974-07-27"
          "yyyy-MM-dd"
          (java-time.api/local-date-time "yyyy-MM-dd'T'HH:mm:ss'Z'" "1974-07-27T00:00:00Z"))
         "Possibility 2"
         (str ;=> "1974-07-27"
          (java-time.api/local-date ;=> #object [java.time.LocalDate 0x3294ff65 "1974-07-27"]
           (java-time.api/formatter "yyyy-MM-dd'T'HH:mm:ss'Z'") "1974-07-27T00:00:00Z"))
         (.toString ;=> "1974-07-27"
          (java-time.api/local-date ;=> #object [java.time.LocalDate 0x3294ff65 "1974-07-27"]
           (java-time.api/formatter "yyyy-MM-dd'T'HH:mm:ss'Z'") "1974-07-27T00:00:00Z"))
         "Possibility 3"
         (java-time.api/format ;=> "1974-07-27"
          "YYYY-MM-DD"
          (java-time.api/local-date-time ;=> #object [java.time.LocalDateTime 0x54d094ca "1974-07-27T02:00"]
           (java-time.api/zoned-date-time ;=> #object [java.time.ZonedDateTime 0x76b143cb "1974-07-27T02:00+02:00[UTC+02:00]"]
            (java-time.api/instant "1974-07-27T00:00:00Z") ;=> #object [java.time.Instant 0xd4c35fc "1974-07-27T00:00:00Z"]
            "UTC+2")))
         "Possibility 4"
         (java-time.api/format ;=> "1974-07-27"
          (java-time.api/formatter "yyyy-MM-dd")
          (java-time.api/zoned-date-time
           (java-time.api/instant "1974-07-27T00:00:00Z")
           "UTC+2"))

         )

(comment "Common used java-time conversions from clj-time"

         "Joda-Time => Java-Time"
         (clj-time.core/now) ;=> #clj-time/date-time "2023-01-17T13:13:16.221Z"
         (java-time.api/to-java-date (clj-time.core/now)) ;=> #inst "2023-01-17T13:13:36.752-00:00"
         (java-time.api/local-date-time (clj-time.core/now)) ;=> #object [java.time.LocalDateTime 0x6f919078 "2023-01-17T13:13:52.359"]

         "OLD"
         (.format
          (java.text.SimpleDateFormat. "yyyy-MM-dd")  ;; to
          (.parse
           (java.text.SimpleDateFormat. "dd-MM-yyyy")  ;; from
           "01-10-2010")) ;=> "2010-10-01"
         "NEW"
         (java-time.api/format
          "yyyy-MM-dd"
          (java-time.api/local-date
           (java-time.api/formatter "dd-MM-yyyy")
           "01-10-2010")) ;=> "2010-10-01"
         "WITHOUT ANY TIME API - USING REGEX AND STRING"
         (clojure.string/join "-" (reverse (re-seq #"\d+" "01-10-2010"))) ;=> "2010-10-01"

         "OLD"
         (.format
          (java.text.SimpleDateFormat. "MMMM" (new java.util.Locale "nl", "NL"))  ;; to
          (.parse
           (java.text.SimpleDateFormat. "dd-MM-yyyy")  ;; from
           "09-05-2022")) ;=> mei
         "NEW"
         (java-time.api/format
          (java.time.format.DateTimeFormatter/ofPattern "MMMM" (new java.util.Locale "nl", "NL"))
          (java-time.api/local-date "dd-MM-yyyy" "09-05-2022")) ;=> mei

         "OLD"
         (-> (clj-time.format/formatters :year-month-day)
             (clj-time.format/parse "2022-06-25")) ;=> #clj-time/date-time "2022-06-25T00:00:00.000Z"
         "NEW"
         (java-time.api/local-date-time
          (java-time.api/local-date "2022-06-25")
          (java-time.api/offset-time 0)) ;=> #object [java.time.LocalDateTime 0x60d32bd4 "2022-06-25T00:00"]

         "OLD"
         (-> (clj-time.format/formatters :date-hour-minute-second-ms)
             (clj-time.format/with-zone (clj-time.core/default-time-zone))
             (clj-time.format/parse "2022-02-16T11:37:01.122")) ;=> #clj-time/date-time "2022-02-16T10:37:01.122Z"
         "NEW"
         #_(java-time.api/local-date-time "2022-02-16T11:37:01.122") ;=> #object [java.time.LocalDateTime 0x3503e99c "2022-02-16T11:37:01.122"]
         #_(java.time.format.DateTimeFormatter/ofPattern "yyyy-MM-dd'T'HH:mm:ss:SSS")
         #_(java-time.api/formatter "yyyy-MM-dd'T'HH:mm:ss:SSS")
         (java-time.api/local-date-time (java-time.api/formatter "yyyy-MM-dd'T'HH:mm:ss:SSS") "2022-02-16T11:37:01:122") ;=> #object [java.time.LocalDateTime 0x2c33ab11 "2022-02-16T11:37:01.122"]

         "OLD"
         (clj-time.coerce/to-date-time "2013-08-30T09:05:09Z") ;=> #clj-time/date-time "2013-08-30T09:05:09.000Z"
         (clj-time.coerce/to-date-time "2013-08-30") ;=> #clj-time/date-time "2013-08-30T09:05:09.000Z"
         "NEW"
         #_(java-time.api/local-date-time (java-time.api/instant "2013-08-30T09:05:09Z") "UTC") ;=> #object [java.time.LocalDateTime 0x1810f26 "2013-08-30T09:05:09"]
         (java-time.api/local-date-time
          (java-time.api/formatter "yyyy-MM-dd'T'HH:mm:ss'Z'") "2013-08-30T09:05:09Z") ;=> #object [java.time.LocalDateTime 0x6892b4dd "2013-08-30T09:05:09"]

         "OLD"
         (-> (clj-time.format/formatters :year-month-day)
             (clj-time.format/unparse (clj-time.core/now))) ;=> "2022-12-15"
         "NEW"
         (java-time.api/format "yyyy-MM-dd" (java-time.api/local-date-time)) ;=> "2022-12-15"

         "OLD"
         (-> (clj-time.format/formatters :date-hour-minute)
             (clj-time.format/with-zone (clj-time.core/default-time-zone))
             (clj-time.format/unparse (clj-time.core/now))) ;=> "2022-12-15T14:09"
         "NEW"
         (java-time.api/format "yyyy-MM-dd'T'HH:mm" (java-time.api/local-date-time)) ;=> "2022-12-15T14:10"

         "OLD"
         (-> (clj-time.format/formatters :date-hour-minute-second)
             (clj-time.format/with-zone (clj-time.core/default-time-zone))
             (clj-time.format/unparse (clj-time.core/now))) ;=> "2022-12-15T14:15:44"
         "NEW"
         (java-time.api/format "yyyy-MM-dd'T'HH:mm:ss" (java-time.api/local-date-time)) ;=> "2022-12-15T14:15:57"

         "OLD"
         (-> (clj-time.format/formatters :date-hour-minute-second-ms)
             (clj-time.format/with-zone (clj-time.core/default-time-zone))
             (clj-time.format/unparse (clj-time.core/now))) ;=> "2022-12-15T14:17:37.067"
         "NEW"
         (java-time.api/format "yyyy-MM-dd'T'HH:mm:ss.SSS" (java-time.api/local-date-time)) ;=> "2022-12-15T14:18:18.018"

         "OLD"
         (clj-time.core/before? (clj-time.core/date-time 2022 01 01) (clj-time.core/with-time-at-start-of-day (clj-time.core/plus (clj-time.core/now) (clj-time.core/days 1))))
         "NEW"
         (java-time.api/before? (java-time.api/local-date-time 2022 01 01) (java-time.api/plus (java-time.api/local-date-time (java-time.api/local-time 00)) (java-time.api/days 1)))

         "OLD"
         (clj-time.core/after? (clj-time.core/date-time 2022 01 01) (clj-time.core/with-time-at-start-of-day (clj-time.core/now)))
         "NEW"
         (java-time.api/after? (java-time.api/local-date-time 2022 01 01) (java-time.api/local-date-time))

         "OLD"
         (clj-time.core/with-time-at-start-of-day (clj-time.core/now)) ;=> #clj-time/date-time "2022-12-15T00:00:00.000Z"
         "NEW"
         (java-time.api/local-date-time (java-time.api/offset-time 0)) ;=> #object [java.time.LocalDateTime 0x6fae8c8c "2022-12-15T00:00"]

         "OLD"
         (-> (clj-time.core/with-time-at-start-of-day (clj-time.core/now))
             (clj-time.core/plus (clj-time.core/years 2))
             (clj-time.core/minus (clj-time.core/days 1))) ;=> #clj-time/date-time "2024-12-14T00:00:00.000Z"
         "NEW"
         (-> (java-time.api/local-date-time (java-time.api/offset-time 0))
             (java-time.api/plus (java-time.api/years 2))
             (java-time.api/plus (java-time.api/days 1))) ;=> #object [java.time.LocalDateTime 0x4df890c1 "2024-12-16T00:00"]

         "OLD"
         (reduce #(if (clj-time.core/before? %1 %2) %1 %2) dt dts) ; source of min-date
         (clj-time.core/min-date (-> (clj-time.core/with-time-at-start-of-day (clj-time.core/now)) ; two-years-after-begin-date
                                     (clj-time.core/plus (clj-time.core/years 2))
                                     (clj-time.core/minus (clj-time.core/days 1)))
                                 (-> (redacted.common.xml/parse-date "2010-05-25") ; date-at-max-age
                                     (clj-time.core/plus (clj-time.core/years 23))
                                     (clj-time.core/minus (clj-time.core/days 1)))) ;=> #clj-time/date-time "2024-12-14T00:00:00.000Z"
         "NEW"
         (java-time.api/min (-> (java-time.api/local-date-time (java-time.api/offset-time 0))
                                (java-time.api/plus (java-time.api/years 2))
                                (java-time.api/minus (java-time.api/days 1)))
                            (-> (redacted.common.datetime/parse-date "2010-05-25")
                                (java-time.api/plus (java-time.api/years 23))
                                (java-time.api/minus (java-time.api/days 1)))) ;=> #object [java.time.LocalDateTime 0x78fea0a "2024-12-14T00:00"]
         "NEW TEST - same as OLD"
         (reduce #(if (java-time.api/before? %1 %2) %1 %2)
                 (-> (java-time.api/local-date-time (java-time.api/offset-time 0))
                     (java-time.api/plus (java-time.api/years 2))
                     (java-time.api/minus (java-time.api/days 1)))
                 (list (-> (redacted.common.datetime/parse-date "2010-05-25")
                           (java-time.api/plus (java-time.api/years 23))
                           (java-time.api/minus (java-time.api/days 1))))) ;=> #object [java.time.LocalDateTime 0x33281138 "2024-12-14T00:00"]
         )