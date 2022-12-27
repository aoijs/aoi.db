import { TypedEmitter } from "tiny-typed-emitter";
import { DatabaseEvents } from "../typings/enums";
export declare class Constructor extends TypedEmitter<DatabaseEvents> {
    constructor();
    set(): void;
    get(): void;
    delete(): void;
    all(): void;
    static add(method: string, cb: Function): void;
}
//# sourceMappingURL=index.d.ts.map