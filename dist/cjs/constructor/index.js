"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Constructor = void 0;
const tiny_typed_emitter_1 = require("tiny-typed-emitter");
class Constructor extends tiny_typed_emitter_1.TypedEmitter {
    constructor() {
        super();
    }
    set() { }
    get() { }
    delete() { }
    all() { }
    static add(method, cb) {
        //@ts-ignore
        Constructor.prototype[method] = cb;
    }
}
exports.Constructor = Constructor;
//# sourceMappingURL=index.js.map