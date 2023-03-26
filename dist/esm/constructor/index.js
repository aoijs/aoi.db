import { TypedEmitter } from "tiny-typed-emitter";
export class Constructor extends TypedEmitter {
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
//# sourceMappingURL=index.js.map