export class Node {
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
//# sourceMappingURL=node.js.map