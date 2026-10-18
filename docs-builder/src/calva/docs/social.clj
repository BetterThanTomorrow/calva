(ns calva.docs.social
  "Draws the social card for a page: the site name, the logo, the page title, and its description,
  placed like Material's social cards."
  (:require [clojure.string :as string])
  (:import [java.awt Color Font Graphics2D RenderingHints]
           [java.awt.geom AffineTransform Path2D$Double]
           [java.awt.image BufferedImage]
           [java.io ByteArrayOutputStream File]
           [javax.imageio ImageIO]))

;; Before AWT starts, so that the JVM doesn't show up as an app on macOS.
(System/setProperty "java.awt.headless" "true")

(def ^:private card-size [1200 630])
(def ^:private logo-box {:logo/at [972 60] :logo/size 144})
(def ^:private text-width 826)
(def ^:private text-boxes
  [{:text/key :card/site-name :text/font :bold :text/size 36 :text/at [68 64] :text/lines 1 :text/spacing 20}
   {:text/key :card/title :text/font :bold :text/size 92 :text/at [64 160] :text/lines 3 :text/spacing 30}
   {:text/key :card/description :text/font :regular :text/size 28 :text/at [68 512] :text/lines 2 :text/spacing 14}])

(defn- path-shape
  "Returns the SVG path data `d` as a shape. Handles the absolute M, C, V, and Z commands."
  [d]
  (let [path (Path2D$Double.)]
    (doseq [[_ command numbers] (re-seq #"([MCVZ])([^MCVZ]*)" d)
            :let [ns (map parse-double (re-seq #"-?(?:\d*\.\d+|\d+)" numbers))]]
      (case command
        "M" (let [[x y] ns] (.moveTo path x y))
        "C" (doseq [[x1 y1 x2 y2 x y] (partition 6 ns)] (.curveTo path x1 y1 x2 y2 x y))
        "V" (.lineTo path (.getX (.getCurrentPoint path)) (first ns))
        "Z" (.closePath path)))
    path))

(defn- svg-logo [svg]
  {:svg/width (parse-double (second (re-find #"viewBox=\"[\d.]+ [\d.]+ ([\d.]+)" svg)))
   :svg/paths (for [[_ d fill] (re-seq #"<path d=\"([^\"]*)\" fill=\"([^\"]*)\"" svg)]
                {:path/shape (path-shape d) :path/fill (Color/decode fill)})})

(defn- draw-logo! [^Graphics2D g svg]
  (let [{:svg/keys [width paths]} (svg-logo svg)
        {[x y] :logo/at :logo/keys [size]} logo-box
        scale (/ size width)
        transform (doto (AffineTransform.) (.translate (double x) (double y)) (.scale scale scale))]
    (doseq [{:path/keys [shape fill]} paths]
      (.setColor g fill)
      (.fill g (.createTransformedShape transform shape)))))

(defn wrap-words
  "Returns `text` as lines, each filled with as many words as `fits?` accepts."
  [fits? text]
  (reduce (fn [lines word]
            (let [joined (str (peek lines) " " word)]
              (if (and (seq lines) (fits? joined))
                (conj (pop lines) joined)
                (conj lines word))))
          []
          (string/split (string/trim text) #"\s+")))

(defn- draw-text!
  "Draws `text` in `box`, with the ink of the first line starting half the spacing down the box."
  [^Graphics2D g fonts ^String text {:text/keys [font size at lines spacing]}]
  (let [font (.deriveFont ^Font (fonts font) (float size))
        frc (.getFontRenderContext g)
        ink-height (- (.getY (.getVisualBounds (.createGlyphVector font frc text))))
        fits? #(<= (.getWidth (.getStringBounds font ^String % frc)) text-width)
        [x y] at]
    (.setFont g font)
    (doseq [[i ^String line] (map-indexed vector (take lines (wrap-words fits? text)))]
      (.drawString g line (float x) (float (+ y (/ spacing 2) ink-height (* i (+ ink-height spacing))))))))

(defn- png-bytes [^BufferedImage image]
  (let [out (ByteArrayOutputStream.)]
    (ImageIO/write image "png" out)
    (.toByteArray out)))

(defn- render-card [{:card/keys [font-files logo background color] :as card}]
  (let [[width height] card-size
        image (BufferedImage. width height BufferedImage/TYPE_INT_ARGB)
        g (.createGraphics image)
        fonts (update-vals font-files #(Font/createFont Font/TRUETYPE_FONT ^File %))]
    (try
      (doto g
        (.setRenderingHint RenderingHints/KEY_ANTIALIASING RenderingHints/VALUE_ANTIALIAS_ON)
        (.setRenderingHint RenderingHints/KEY_TEXT_ANTIALIASING RenderingHints/VALUE_TEXT_ANTIALIAS_ON)
        (.setRenderingHint RenderingHints/KEY_FRACTIONALMETRICS RenderingHints/VALUE_FRACTIONALMETRICS_ON)
        (.setColor (Color/decode background))
        (.fillRect 0 0 width height)
        (draw-logo! logo)
        (.setColor (Color/decode color)))
      (doseq [{:text/keys [key] :as box} text-boxes
              :when (not (string/blank? (card key)))]
        (draw-text! g fonts (card key) box))
      (finally
        (.dispose g)))
    (png-bytes image)))

(def ^:private render-card-memo (memoize render-card))

(defn card-png
  "Returns the social card for `page` as PNG bytes. Cards are kept, so that the serve loop only
  draws the cards whose text changed."
  [{:site/keys [name description] :social-card/keys [font-files logo background-color color]}
   {:page/keys [title] page-description :page/description}]
  (render-card-memo {:card/site-name name
                     :card/title title
                     :card/description (or page-description description)
                     :card/font-files font-files
                     :card/logo logo
                     :card/background background-color
                     :card/color color}))
