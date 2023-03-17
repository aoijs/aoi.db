"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphDb = void 0;
const list_1 = require("./list");
class GraphDb {
    #edges = new Map();
    #nodes = new list_1.List("list");
    constructor() {
    }
}
exports.GraphDb = GraphDb;
//# sourceMappingURL=database.js.map