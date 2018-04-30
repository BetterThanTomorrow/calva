const util = require('./utilities');
const statusbar = require('./statusbar');

function update() {
    util.updateREPLSessionType();
    statusbar.update();
}

module.exports = {
    update
}