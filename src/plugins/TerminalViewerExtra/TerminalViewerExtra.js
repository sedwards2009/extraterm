"use strict";
const Logger = require("../../logger");
class TerminalViewerExtra {
    constructor(api) {
        this._log = new Logger("TerminalViewerExtra", this);
        api.addNewTopLevelEventListener((el) => {
            this._log.debug("Saw a new top level");
        });
        api.addNewTabEventListener((el) => {
            this._log.debug("Saw a new tab level");
        });
    }
}
function factory(api) {
    return new TerminalViewerExtra(api);
}
module.exports = factory;
//# sourceMappingURL=TerminalViewerExtra.js.map