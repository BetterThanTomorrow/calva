import * as fs from 'fs';
import * as _ from 'lodash';
import * as edn from 'jsedn';
import * as state from './state';
import * as util from './utilities';

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
    let parsed = edn.parse(fs.readFileSync(shadowConfigFile(), 'utf8').toString()),
        keys = parsed.at(edn.kw(':builds')).keys,
        builds = _.map(keys, 'name');
    builds.push("node-repl");
    builds.push("browser-repl")
    return builds;
}

export function shadowBuild() {
    return state.deref().get('shadowBuild');
}
