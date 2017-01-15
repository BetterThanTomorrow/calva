module.exports = {
    CLJS: {
        id: 100,
        statusbar: "(clj/cljs)",
        supports: ["cljc", "clj", "cljs"]
    },
    CLJ: {
        id: 200,
        statusbar: "(clj)",
        supports: ["cljc", "clj"]
    },
    NONE: {
        id: 300,
        statusbar: "(-)",
        supports: []
    }
}
