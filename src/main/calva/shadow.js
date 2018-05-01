const fs = require('fs');
const _ = require('lodash');
const edn = require('jsedn');
const state = require('./state');
const util = require('./utilities');

function shadowNReplPortFile() {
    return util.getProjectDir() + '/.shadow-cljs/nrepl.port';
}

function shadowConfigFile() {
    return util.getProjectDir() + '/shadow-cljs.edn';
}

function isShadowCljs() {
    return fs.existsSync(shadowNReplPortFile());
}

function shadowBuilds() {
    let parsed = edn.parse(fs.readFileSync(shadowConfigFile(), 'utf8').toString()),
        keys = parsed.at(edn.kw(':builds')).keys;
    return _.map(keys, 'name');
}

function shadowBuild() {
    return state.deref().get('shadowBuild');
}

module.exports = {
    isShadowCljs,
    shadowNReplPortFile,
    shadowBuilds,
    shadowBuild
}