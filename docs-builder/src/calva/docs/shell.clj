(ns calva.docs.shell
  "The Material page around each docs page."
  (:require [calva.docs.nav :as nav]
            [calva.docs.toc :as toc]
            [calva.docs.url :as url]
            [clojure.data.json :as json]
            [clojure.string :as string]
            [hiccup2.core :as h]))

(def ^:private live-reload-script
  "new WebSocket('ws://' + location.host + '/__reload').onmessage = () => location.reload();")

(defn- icon [{:material/keys [icons]} k]
  (let [{:icon/keys [view-box path comment]} (icons k)]
    [:svg {:xmlns "http://www.w3.org/2000/svg" :viewBox view-box}
     (when comment (h/raw (str "<!--" comment "-->")))
     [:path {:d path}]]))

(defn- logo [{:site/keys [name logo]} {:page/keys [url]} class]
  [:a {:class [class "md-logo"]
       :href (url/site-href url "")
       :title name
       :aria-label name
       :data-md-component "logo"}
   [:img {:src (url/site-href url logo) :alt "logo"}]])

(defn- source [{:repo/keys [name url] :as site}]
  [:a.md-source {:href url :title "Go to repository" :data-md-component "source"}
   [:div.md-source__icon.md-icon (icon site :git-alt)]
   [:div.md-source__repository name]])

(defn- palette [{:material/keys [palette] palette-script :script/palette :as site}]
  (list
   [:form.md-header__option {:data-md-component "palette"}
    (map-indexed
     (fn [i {:palette/keys [media scheme primary accent name] icon-key :palette/icon}]
       (list [:input.md-option {:type "radio"
                                :name "__palette"
                                :id (str "__palette_" i)
                                :aria-label name
                                :data-md-color-media media
                                :data-md-color-scheme scheme
                                :data-md-color-primary primary
                                :data-md-color-accent accent}]
             [:label.md-header__button.md-icon {:for (str "__palette_" (mod (inc i) (count palette)))
                                                :title name
                                                :hidden true}
              (icon site icon-key)]))
     palette)]
   [:script (h/raw palette-script)]))

(defn- search [site]
  [:div.md-search {:data-md-component "search" :role "dialog"}
   [:label.md-search__overlay {:for "__search"}]
   [:div.md-search__inner {:role "search"}
    [:form.md-search__form {:name "search"}
     [:input.md-search__input {:type "text"
                               :name "query"
                               :aria-label "Search"
                               :placeholder "Search"
                               :autocapitalize "off"
                               :autocorrect "off"
                               :autocomplete "off"
                               :spellcheck "false"
                               :required true
                               :data-md-component "search-query"}]
     [:label.md-search__icon.md-icon {:for "__search"}
      (icon site :magnify)
      (icon site :arrow-left)]
     [:nav.md-search__options {:aria-label "Search"}
      [:a.md-search__icon.md-icon {:href "javascript:void(0)"
                                   :title "Share"
                                   :aria-label "Share"
                                   :data-clipboard true
                                   :data-clipboard-text ""
                                   :data-md-component "search-share"
                                   :tabindex "-1"}
       (icon site :share)]
      [:button.md-search__icon.md-icon {:type "reset" :title "Clear" :aria-label "Clear" :tabindex "-1"}
       (icon site :close)]]]
    [:div.md-search__output
     [:div.md-search__scrollwrap {:data-md-scrollfix true}
      [:div.md-search-result {:data-md-component "search-result"}
       [:div.md-search-result__meta "Initializing search"]
       [:ol.md-search-result__list {:role "presentation"}]]]]]])

(defn- header [{:site/keys [name] :as site} {:page/keys [title] :as page}]
  [:header.md-header.md-header--shadow {:data-md-component "header"}
   [:nav.md-header__inner.md-grid {:aria-label "Header"}
    (logo site page "md-header__button")
    [:label.md-header__button.md-icon {:for "__drawer"} (icon site :menu)]
    [:div.md-header__title {:data-md-component "header-title"}
     [:div.md-header__ellipsis
      [:div.md-header__topic [:span.md-ellipsis name]]
      [:div.md-header__topic {:data-md-component "header-topic"} [:span.md-ellipsis title]]]]
    (palette site)
    [:label.md-header__button.md-icon {:for "__search"} (icon site :magnify)]
    (search site)
    [:div.md-header__source (source site)]]])

(defn- primary-sidebar [{:site/keys [name] :as site} page]
  [:div.md-sidebar.md-sidebar--primary {:data-md-component "sidebar" :data-md-type "navigation"}
   [:div.md-sidebar__scrollwrap
    [:div.md-sidebar__inner
     [:nav.md-nav.md-nav--primary {:aria-label "Navigation" :data-md-level "0"}
      [:label.md-nav__title {:for "__drawer"} (logo site page "md-nav__button") name]
      [:div.md-nav__source (source site)]
      (nav/primary-nav site page)]]]])

(defn- toc-sidebar [{:page/keys [toc]}]
  [:div.md-sidebar.md-sidebar--secondary {:data-md-component "sidebar" :data-md-type "toc"}
   [:div.md-sidebar__scrollwrap
    [:div.md-sidebar__inner
     (toc/toc-nav toc)]]])

(def ^:private footer
  [:footer.md-footer
   [:div.md-footer-meta.md-typeset
    [:div.md-footer-meta__inner.md-grid
     [:div.md-copyright "Made with "
      [:a {:href "https://squidfunk.github.io/mkdocs-material/" :target "_blank" :rel "noopener"}
       "Material for MkDocs"]]]]])

(defn- analytics
  [{:analytics/keys [google-property plausible-domain] :build/keys [production?] analytics-script :script/analytics}]
  (list [:script#__analytics (h/raw (string/replace analytics-script "{{property}}" google-property))]
        (when production?
          [:script {:defer true :data-domain plausible-domain :src "https://plausible.io/js/script.js"}])))

(defn- page-links [{site-url :site/url} {:page/keys [src url prev-url next-url]}]
  (list (when src [:link {:rel "canonical" :href (str site-url "/" url)}])
        (when prev-url [:link {:rel "prev" :href (url/site-href url prev-url)}])
        (when next-url [:link {:rel "next" :href (url/site-href url next-url)}])))

(defn- social-meta
  [{site-url :site/url site-name :site/name :site/keys [description]}
   {:page/keys [src url title] page-description :page/description}]
  (when src
    (let [title (str title " - " site-name)
          description (or page-description description)
          image (str site-url "/" (url/social-card-path src))]
      (list [:meta {:property "og:type" :content "website"}]
            [:meta {:property "og:title" :content title}]
            [:meta {:property "og:description" :content description}]
            [:meta {:property "og:image" :content image}]
            [:meta {:property "og:image:type" :content "image/png"}]
            [:meta {:property "og:image:width" :content "1200"}]
            [:meta {:property "og:image:height" :content "630"}]
            [:meta {:property "og:url" :content (str site-url "/" url)}]
            [:meta {:name "twitter:card" :content "summary_large_image"}]
            [:meta {:name "twitter:title" :content title}]
            [:meta {:name "twitter:description" :content description}]
            [:meta {:name "twitter:image" :content image}]))))

(defn- head
  [{:site/keys [name description favicon extra-css]
    :material/keys [stylesheets fonts-stylesheet fonts-style] :script/keys [md-helpers] :as site}
   {:page/keys [url title] page-description :page/description :as page}]
  (let [href #(url/site-href url %)]
    [:head
     [:meta {:charset "utf-8"}]
     [:meta {:name "viewport" :content "width=device-width,initial-scale=1"}]
     [:meta {:name "description" :content (or page-description description)}]
     (page-links site page)
     (social-meta site page)
     [:link {:rel "icon" :href (href favicon)}]
     [:title (if title (str title " - " name) name)]
     (for [path stylesheets] [:link {:rel "stylesheet" :href (href path)}])
     [:link {:rel "preconnect" :href "https://fonts.gstatic.com" :crossorigin ""}]
     [:link {:rel "stylesheet" :href fonts-stylesheet}]
     [:style (h/raw fonts-style)]
     (for [path extra-css] [:link {:rel "stylesheet" :href (href path)}])
     [:script (h/raw (str "__md_scope=new URL(" (json/write-str (url/site-root url)) ",location),"
                          md-helpers))]
     (analytics site)]))

(defn- config-json [{:material/keys [features search-worker translations]} {:page/keys [url]}]
  (json/write-str {:base (url/site-root url)
                   :features features
                   :search (url/site-href url search-worker)
                   :translations translations}))

(defn- body [{:material/keys [palette bundle] :build/keys [live-reload?] :script/keys [tabs-restore hash-target]
              :as site}
             {:page/keys [url body h1 title headings] :as page}]
  (let [{:palette/keys [scheme primary accent]} (first palette)]
    [:body {:dir "ltr"
            :data-md-color-scheme scheme
            :data-md-color-primary primary
            :data-md-color-accent accent}
     [:input.md-toggle {:type "checkbox" :id "__drawer" :autocomplete "off" :data-md-toggle "drawer"}]
     [:input.md-toggle {:type "checkbox" :id "__search" :autocomplete "off" :data-md-toggle "search"}]
     [:label.md-overlay {:for "__drawer"}]
     [:div {:data-md-component "skip"}
      (when-let [{:heading/keys [id]} (first headings)]
        [:a.md-skip {:href (str "#" id)} "Skip to content"])]
     [:div {:data-md-component "announce"}]
     (header site page)
     [:div.md-container {:data-md-component "container"}
      [:main.md-main {:data-md-component "main"}
       [:div.md-main__inner.md-grid
        (primary-sidebar site page)
        (toc-sidebar page)
        [:div.md-content {:data-md-component "content"}
         [:article.md-content__inner.md-typeset
          (when-not h1 [:h1 title])
          body]]
        [:script (h/raw tabs-restore)]
        [:script (h/raw hash-target)]]]
      footer]
     [:div.md-dialog {:data-md-component "dialog"} [:div.md-dialog__inner.md-typeset]]
     [:script#__config {:type "application/json"} (h/raw (config-json site page))]
     [:script {:src (url/site-href url bundle)}]
     (when live-reload? [:script (h/raw live-reload-script)])]))

(defn page-html
  "Returns the HTML document for `page` in `site`."
  [site page]
  (str "<!doctype html>\n"
       (h/html [:html.no-js {:lang "en"} (head site page) (body site page)])))
