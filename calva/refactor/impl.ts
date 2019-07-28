import {WorkspaceEdit, workspace, InputBoxOptions, window } from 'vscode';
import * as refacortUtils from './utils';
import * as util from '../utilities';

async function artifactVersions(document = {}) {
    let { client, chan, isValid } = refacortUtils.neededVariables(document);

    if (isValid) {
        chan.appendLine("Artifact-Versions");

        let options: InputBoxOptions = {
            prompt: "Artifact: ",
            placeHolder: "(artifact eg. org.clojure/clojure)"
        }

        window.showInputBox(options).then(value => {
            if (!value) return;
            let artifact = value;

            console.log("User Artifact: " + artifact);

            if (artifact) {
                return client.artifactVersions(artifact);
            }
        }).then(response => {
            let { versions } = response;
            console.log("Artifact Versions:", versions);
        });
    }
}

async function cleanNS(document = {}) {
    let { doc, fileName, client, chan, isValid } = refacortUtils.neededVariables(document);
    let filePath = doc.fileName;
    let nsName = util.getDocumentNamespace(doc);

    if (isValid) {
        chan.appendLine("Clean-NS: " + fileName);
        let { ns } = await client.cleanNS(filePath);

        if (ns) {
            let namespaceRange = refacortUtils.findNamespaceRange(doc);
            let edit = new WorkspaceEdit();
            edit.replace(doc.uri, namespaceRange, ns);

            workspace.applyEdit(edit).then(() => {
                window.showInformationMessage("Cleaned ns form for " + nsName);
            });
        } else {
            window.showInformationMessage("Nothing to clean for ns " + nsName)
        }
    }
}

export {
    artifactVersions,
    cleanNS
}