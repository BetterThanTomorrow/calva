(ns calva.docs.nav
  "The site nav as Material's primary navigation."
  (:require [calva.docs.url :as url]
            [clojure.string :as string]))

(declare nav-list)

(defn- page-item [{:site/keys [pages-by-src]} {:page/keys [url] :as page} src]
  (let [{:page/keys [title] target :page/url} (pages-by-src src)]
    (if (= src (:page/src page))
      [:li {:class "md-nav__item md-nav__item--active"}
       [:input {:class "md-nav__toggle md-toggle" :type "checkbox" :id "__toc"}]
       [:a {:class "md-nav__link md-nav__link--active" :href "./"}
        [:span.md-ellipsis title]]]
      [:li.md-nav__item
       [:a.md-nav__link {:href (url/site-href url target)}
        [:span.md-ellipsis title]]])))

(defn- section-item [site page path [title & entries]]
  (let [id (str "__nav_" (string/join "_" path))
        label-id (str id "_label")
        active? (boolean (some #{(:page/src page)} (flatten entries)))]
    [:li {:class ["md-nav__item" (when active? "md-nav__item--active") "md-nav__item--nested"]}
     [:input {:class "md-nav__toggle md-toggle" :type "checkbox" :id id :checked active?}]
     [:label.md-nav__link {:for id :id label-id :tabindex "0"}
      [:span.md-ellipsis title]
      [:span.md-nav__icon.md-icon]]
     [:nav.md-nav {:data-md-level (count path)
                   :aria-labelledby label-id
                   :aria-expanded (str active?)}
      [:label.md-nav__title {:for id} [:span.md-nav__icon.md-icon] title]
      (nav-list site page path entries)]]))

(defn- nav-list [site page path entries]
  [:ul.md-nav__list {:data-md-scrollfix true}
   (map-indexed (fn [i entry]
                  (if (string? entry)
                    (page-item site page entry)
                    (section-item site page (conj path (inc i)) entry)))
                entries)])

(defn primary-nav
  "Returns the hiccup list of the `:site/nav` entries, with `page` and its sections active."
  [{:site/keys [nav] :as site} page]
  (nav-list site page [] nav))
