import fs from 'fs';
import _ from 'lodash';
import edn from 'jsedn';
import * as state from './state';
import * as util from './utilities';

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

export default {
    isShadowCljs,
    shadowNReplPortFile,
    shadowBuilds,
    shadowBuild
};