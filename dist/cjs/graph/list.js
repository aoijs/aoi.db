"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.List = void 0;
class List {
    data;
    next;
    constructor(type) {
        this.data = new List("node");
        this.next = null;
    }
}
exports.List = List;
//# sourceMappingURL=list.js.map