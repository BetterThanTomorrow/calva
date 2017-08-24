const vscode = require('vscode');

function getNamespace(text) {
    let match = text.match(/^[\s\t]*\((?:[\s\t\n]*(?:in-){0,1}ns)[\s\t\n]+'?([\w.\-\/]+)[\s\S]*\)[\s\S]*/);
    return match ? match[1] : 'user';
};

function getActualWord(document, position, selected, word) {
    if (selected === undefined) {
        let selectedChar = document.lineAt(position.line).text.slice(position.character, position.character + 1),
            isFn = document.lineAt(position.line).text.slice(position.character - 1, position.character) === "(";
        if (this.specialWords.indexOf(selectedChar) !== -1 && isFn) {
            return selectedChar;
        } else {
            console.error("Unsupported selectedChar '" + selectedChar + "'");
            return word;
        }
    } else {
        return word;
    }
};

function getDocument(document) {
  return document.hasOwnProperty('fileName') ? document : vscode.window.activeTextEditor.document;
};

function getFileType(document) {
  let doc = getDocument(document);
  filetypeIndex = (doc.fileName.lastIndexOf('.') + 1);
  return doc.fileName.substr(filetypeIndex, doc.fileName.length);
};

function getFileName(document) {
  let fileNameIndex = (document.fileName.lastIndexOf('\\') + 1);
  return document.fileName.substr(fileNameIndex, document.fileName.length)
};

module.exports = {
    getNamespace,
    getActualWord,
    getDocument,
    getFileType,
    getFileName
};
