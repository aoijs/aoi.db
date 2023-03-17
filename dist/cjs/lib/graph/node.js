"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Node = void 0;
class Node {
    key;
    value;
    id;
    cont;
    parent;
    constructor(data) {
        this.key = data.key;
        this.value = data.value;
        this.cont = null;
        this.parent = null;
        this.id = data.id;
    }
}
exports.Node = Node;
//# sourceMappingURL=node.js.map