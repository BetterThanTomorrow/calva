import fs from 'fs';
import _ from 'lodash';
import edn from 'jsedn';
import { deref } from './state';
import { getProjectDir } from './utilities';

function shadowNReplPortFile() {
    return getProjectDir() + '/.shadow-cljs/nrepl.port';
}

function shadowConfigFile() {
    return getProjectDir() + '/shadow-cljs.edn';
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
    return deref().get('shadowBuild');
}

export {
    isShadowCljs,
    shadowNReplPortFile,
    shadowBuilds,
    shadowBuild
};