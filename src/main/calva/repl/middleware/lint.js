import vscode from 'vscode';
import { spawn } from 'child_process';
import * as state from '../../state';
import util from '../../utilities';
const OUTPUT_REGEXP = /.+:([0-9]+)+:([0-9]+): (.+)/

function parseJokerLine(jokerOutput) {
    const matches = OUTPUT_REGEXP.exec(jokerOutput);

    if (!matches) {
        console.warn("joker: could not parse output:", jokerOutput)
        return null;
    }

    const message = {
        line: parseInt(matches[1]),
        reason: matches[3],
        column: parseInt(matches[2]) - 1,
        type: matches[3].includes("warning") ? util.ERROR_TYPE.WARNING : util.ERROR_TYPE.ERROR
    }

    if (!message.line) {
        console.warn("joker: could not find line number:", jokerOutput)
        return null;
    }

    return message
}

function lintDocument(document = {}) {
    let doc = util.getDocument(document);

    if (doc.languageId !== 'clojure') {
        return;
    }
    //Reset errors
    state.deref().get("diagnosticCollection").delete(doc.uri);

    let joker = spawn("joker", ["--lint", doc.fileName]);
    joker.stdout.setEncoding("utf8");

    joker.stderr.on("data", (data) => {
        if (data.length != 0) {
            for (let jokerLine of data.toString().split(/\r?\n/)) {
                if (jokerLine.length != 0) {
                    let msg = parseJokerLine(jokerLine)
                    if (msg != null) {
                        if (msg.type == util.ERROR_TYPE.ERROR) {
                            util.markError(msg);
                            util.logError(msg);
                        } else if (msg.type == util.ERROR_TYPE.WARNING) {
                            util.markWarning(msg);
                            util.logWarning(msg);
                        }
                    }
                }
            }
        }
    });

    joker.on("error", (error) => {
        let {
            lint
        } = state.config()
        let nojoker = error.code == "ENOENT";
        if (nojoker) {
            let errmsg = "linting error: unable to locate 'joker' on path",
                autolintmsg = "You have autolinting enabled. If you want to disable auto-linting set calva.lintOnSave to false in settings";
            vscode.window.showErrorMessage("calva " + errmsg);
            if (lint) {
                vscode.window.showWarningMessage("calva " + autolintmsg);
            }
        } else {
            vscode.window.showErrorMessage("calva " + "linting error: " + error.message);
        }
    });
}

export default {
    lintDocument
};
