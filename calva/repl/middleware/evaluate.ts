import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as clipboardy from 'clipboardy';
import * as state from '../../state';
import annotations from '../../providers/annotations';
import select from './select';
import * as util from '../../utilities';

/// FIXME: We need to add pprint options back in.
async function evaluateSelection(document = {}, options = {}) {
    let current = state.deref(),
        chan = current.get('outputChannel'),
        doc = util.getDocument(document),
        pprint = options["pprint"] || false,
        replace = options["replace"] || false,
        topLevel = options["topLevel"] || false;
    if (current.get('connected')) {
        let client = util.getSession(util.getFileType(doc));
        let editor = vscode.window.activeTextEditor,
            selection = editor.selection,
            codeSelection = null,
            code = "";

        if (selection.isEmpty) {
            codeSelection = select.getFormSelection(doc, selection.active, topLevel);
            code = doc.getText(codeSelection);
        } else {
            codeSelection = selection;
            code = doc.getText(selection);
        }

        if (code.length > 0) {
            annotations.decorateSelection(codeSelection, editor, annotations.AnnotationStatus.PENDING);
            let c = codeSelection.start.character
            
            let err: string[] = [], out: string[] = [];

            let res = await client.eval("(in-ns '"+util.getNamespace(doc.getText())+")").value;

            try {
                let context = client.eval(code, { stdout: m => out.push(m), stderr: m => err.push(m), pprint: !!pprint })
                let value = await context.value
                value = context.pprintOut || value;

                if(replace) {
                    const indent = ' '.repeat(c),
                    edit = vscode.TextEdit.replace(codeSelection, value.replace(/\n/gm, "\n" + indent)),
                    wsEdit = new vscode.WorkspaceEdit();
                    wsEdit.set(editor.document.uri, [edit]);
                    vscode.workspace.applyEdit(wsEdit);
                    chan.appendLine("Replaced inline.")

                    if (out.length > 0) {
                        chan.append("out: ")
                        chan.append(out.join("\n"));
                    }
                    chan.append('=> ');
                    if (pprint) {
                        chan.appendLine('');
                        chan.show(true);
                        chan.appendLine(value);
                    } else chan.appendLine(value);
                    
                    if (err.length > 0) {
                        chan.append("Error: ")
                        chan.append(err.join("\n"));
                    }
                } else {
                    annotations.decorateSelection(codeSelection, editor, annotations.AnnotationStatus.SUCCESS);
                    if (!pprint)
                        annotations.decorateResults(' => ' + value.replace(/\n/gm, " ") + " ", false, codeSelection, editor);                        
                }
            } catch(e) {
                if(!err.length) // venantius/ultra outputs errors on stdout, it seems.
                    err = out;

                annotations.decorateSelection(codeSelection, editor, annotations.AnnotationStatus.ERROR);
                if (!pprint) {
                    const annotation = err.join();
                    annotations.decorateResults(' => ' + annotation.replace(/\n/gm, " ") + " ", true, codeSelection, editor);
                }
            }
        }
     }
}

function evaluateSelectionReplace(document = {}, options = {}) {
    evaluateSelection(document, Object.assign({}, options, { replace: true, pprint: true }));
}

function evaluateSelectionPrettyPrint(document = {}, options = {}) {
    evaluateSelection(document, Object.assign({}, options, { pprint: true }));
}
function evaluateCurrentTopLevelFormPrettyPrint(document = {}, options = {}) {
    evaluateSelection(document, Object.assign({}, options, { pprint: true, topLevel: true }));
}

function evaluateTopLevelForm(document = {}, options = {}) {
    evaluateSelection(document, Object.assign({}, options, { topLevel: true }));
}

async function evaluateFile(document = {}, callback = () => { }) {
    let current = state.deref(),
        doc = util.getDocument(document),
        fileName = util.getFileName(doc),
        fileType = util.getFileType(doc),
        client = util.getSession(util.getFileType(doc)),
        chan = current.get('outputChannel');

    if (doc.languageId == "clojure" && fileType != "edn" && current.get('connected')) {
        let value = await client.loadFile(doc.getText(), { fileName: fileName, filePath: doc.fileName }).value;
        if (value !== null)
            chan.appendLine("=> " + value);
        else
            chan.appendLine("No results from file evaluation.");
    }
    callback();
}

async function copyLastResultCommand() {
    let chan = state.deref().get('outputChannel');
    let client = util.getSession(util.getFileType(util.getDocument({})));

    let value = await client.eval("*1").value;
    if(value !== null)
        clipboardy.writeSync(value);
    else
        chan.appendLine("Nothing to copy");
}

export default {
    evaluateFile,
    evaluateSelection,
    evaluateTopLevelForm,
    evaluateSelectionPrettyPrint,
    evaluateCurrentTopLevelFormPrettyPrint,
    evaluateSelectionReplace,
    copyLastResultCommand
};
