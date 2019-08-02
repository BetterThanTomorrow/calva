import {WorkspaceEdit, workspace, InputBoxOptions, window } from 'vscode';
import * as refacortUtils from './utils';
import * as util from '../utilities';
import * as state from '../state';

async function artifactVersions(document = {}) {
    let { client, chan, isValid } = util.neededVariables(document);

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
    let { doc, fileName, client, chan, isValid } = util.neededVariables(document);
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
                state.analytics().logEvent("Refactor", "clean-ns", "success").send();
            });
        } else {
            window.showInformationMessage("Nothing to clean for ns " + nsName)
            state.analytics().logEvent("Refactor", "clean-ns", "no-clean").send();
        }
    }
}

export {
    artifactVersions,
    cleanNS
}