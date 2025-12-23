(ns scripts.tasks
	(:require
	 [babashka.fs :as fs]
	 [babashka.process :as process]))

(def ^:private build-dirs
	["target"
	 "public/js/compiled"
	 "public/js/compiled-too"])

(defn clean
	"Remove compiled build artifacts so tasks can start fresh."
	[]
	(doseq [dir build-dirs
					:when (fs/exists? dir)]
		(fs/delete-tree dir)))

(defn npm-install
	"Install Node dependencies required by shadow-cljs targets."
	[]
	(process/shell "npm" "install"))

(defn- run-shadow
	[& args]
	(apply process/shell "npx" "shadow-cljs" args))

(defn shadow-dev
	"Start shadow-cljs watch for both the app and backend builds."
	[]
	(run-shadow "watch" "app" "backend"))

(defn backend-repl
	"Launch the deps.edn REPL profile used for backend development."
	[]
	(process/shell "clojure" "-M:dev:repl"))

(defn release
	"Produce an optimized release build via shadow-cljs."
	[]
	(run-shadow "release" "app"))

(defn test-ci
	"Run the CI entry point implemented in shadow-cljs."
	[]
	(run-shadow "run" "ci"))
