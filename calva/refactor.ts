import * as state from './state';
import * as util from './utilities';
import * as path from 'path';

async function artifactVersions(document = {}, callback = () => { }) {
    let current = state.deref(),
        doc = util.getDocument(document),
        fileName = util.getFileName(doc),
        fileType = util.getFileType(doc),
        client = util.getSession(util.getFileType(doc)),
        chan = state.outputChannel();
        
    if (doc && doc.languageId == "clojure" && fileType != "edn" && current.get('connected')) {
        chan.appendLine("Artifact-Versions");

        let {versions} = await client.artifactVersions();
        console.log("Artifact-Versions result:", versions);
    }

    callback();
}

export default {
    artifactVersions
};