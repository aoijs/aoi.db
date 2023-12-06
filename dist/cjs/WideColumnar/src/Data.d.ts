import { WideColumnarDataInterface } from "../typings/interface.js";
export default class WideColumnarData {
    primary: WideColumnarDataInterface;
    column: WideColumnarDataInterface;
    constructor(data: {
        primary: WideColumnarDataInterface;
        column: WideColumnarDataInterface;
    });
    toString(): string;
    toJSON(): {
        primary: WideColumnarDataInterface;
        column: WideColumnarDataInterface;
    };
}
//# sourceMappingURL=Data.d.ts.map