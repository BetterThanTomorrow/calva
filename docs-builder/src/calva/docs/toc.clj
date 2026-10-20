(ns calva.docs.toc
  "A page's table of contents, as data from its headings and as Material's secondary navigation.")

(defn- nest [headings]
  (loop [[{:heading/keys [level] :as heading} & more :as headings] headings
         entries []]
    (if (empty? headings)
      entries
      (let [[children others] (split-with #(> (:heading/level %) level) more)]
        (recur others (conj entries (assoc heading :heading/children (nest children))))))))

(defn page-toc
  "Returns the `headings` as a tree, each heading with its `:heading/children`. When the
  first heading is an H1, the tree is that H1's children."
  [headings]
  (let [[{:heading/keys [level children]} :as entries] (nest headings)]
    (if (= 1 level) children entries)))

(defn- toc-list [entries attrs]
  [:ul.md-nav__list attrs
   (for [{:heading/keys [id text children]} entries]
     [:li.md-nav__item
      [:a.md-nav__link {:href (str "#" id)} [:span.md-ellipsis text]]
      (when (seq children)
        [:nav.md-nav {:aria-label text} (toc-list children {})])])])

(defn toc-nav
  "Returns the hiccup for the `toc` entries as Material's table of contents."
  [toc]
  [:nav.md-nav.md-nav--secondary {:aria-label "Table of contents"}
   (when (seq toc)
     (list [:label.md-nav__title {:for "__toc"} [:span.md-nav__icon.md-icon] "Table of contents"]
           (toc-list toc {:data-md-component "toc" :data-md-scrollfix true})))])
