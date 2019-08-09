import * as fs from 'fs';
import * as _ from 'lodash';
import * as state from './state';
import * as util from './utilities';
const { parseEdn } = require('../cljs-out/cljs-lib');

export async function shadowConfigFile() {
    const projectDir =  await util.getProjectDir();
    return projectDir + '/shadow-cljs.edn';
}

export async function shadowBuilds() {
    let parsed = parseEdn(fs.readFileSync(await shadowConfigFile(), 'utf8').toString()),
        builds = _.map(parsed.builds, (_v, key) => { return ":" + key });
    builds.push("node-repl");
    builds.push("browser-repl")
    return builds;
}

export function shadowBuild() {
    return state.deref().get('cljsBuild');
}
