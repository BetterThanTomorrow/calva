import vscode from 'vscode';
import { spawn } from 'child_process';
import * as state from '../../state';
import * as util from '../../utilities';

function parseJokerLine(jokerOutput) {
    const OUTPUT_REGEXP = /.+:([0-9]+)+:([0-9]+): (.+)/;
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

function logMessage(message) {
    if (message.type == ERROR_TYPE.ERROR) {
        markError(message);
        logError(message);
    } else if (message.type == ERROR_TYPE.WARNING) {
        markWarning(message);
        logWarning(message);
    }
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
        for (const jokerLine of data.toString().split(/\r?\n/)) {
            const message = parseJokerLine(jokerLine)
            
            if (message != null) {
                logMessage(message);
            }
        }
    });

    joker.on("error", (error) => {
        const { lint } = config()
        const nojoker = error.code == "ENOENT";
        
        if (nojoker) {
            const errmsg = "linting error: unable to locate 'joker' on path";
            const autolintmsg = "You have autolinting enabled. If you want to disable auto-linting set calva.lintOnSave to false in settings";
            
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
