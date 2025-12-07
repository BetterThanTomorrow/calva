# TODO multi session

* [x] Per connection CLJC routing
* [x] Default session names beyond clj/cljs
  * Fruits!
* [x] Default file patterns from project type
* [x] Bug when a clj+cljs session is connected, .cljs files from another project root are routed to the clj session
* [x] Default globs for second+ sequence could be prefixed with the project root
* [x] bug shadow-cljs build switcher does work before showing the menu
* [x] bug we show `fiddle/` in the statusbar for fiddle files (we should treat all non-globbed files as cljc and prefix `cljc/`)
* [x] Special session for clojuredocs
* [x] Sessions menu, present non-session items first
* [x] Sessions menu, use basename for "Used for" detail
* [x] Can't repro: Some issue with connecting to shadow projects
* [ ] Split connect-sequence.md info so that the advanced stuff is separate
* [ ] Add session menu screenshots to connect-sequence.md
* [ ] Update/add screenshots to repl-ui.md
* [ ] Update/add screenshots to connect.md