import * as fs from 'fs';
import * as _ from 'lodash';
import * as state from './state';
import * as util from './utilities';
const { parseEdn } = require('../cljs-out/cljs-lib');

export function shadowNReplPortFile() {
    return util.getProjectDir() + '/.shadow-cljs/nrepl.port';
}
export function nreplPortDir() {

    if (fs.existsSync(shadowNReplPortFile()))
        return util.getProjectDir() + "/.shadow-cljs/"
    else
        return util.getProjectDir()
}

export function shadowConfigFile() {
    return util.getProjectDir() + '/shadow-cljs.edn';
}

export function isShadowCljs() {
    return fs.existsSync(shadowNReplPortFile());
}

export function shadowBuilds() {
    let parsed = parseEdn(fs.readFileSync(shadowConfigFile(), 'utf8').toString()),
        builds = _.map(parsed.builds, (_v, key) => { return ":" + key });
    builds.push("node-repl");
    builds.push("browser-repl")
    return builds;
}

export function shadowBuild() {
    return state.deref().get('cljsBuild');
}
