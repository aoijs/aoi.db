import { ReferenceConstantSpace, stringify } from "../../index.js";
import { WideColumnarDataInterface } from "../typings/interface.js";

export default class WideColumnarData {
    primary: WideColumnarDataInterface;
    column: WideColumnarDataInterface;
    constructor(data: {
        primary: WideColumnarDataInterface;
        column: WideColumnarDataInterface;
    }) {
        this.primary = data.primary;
        this.column = data.column;
    }
    toString() {
        return JSON.stringify(this.toJSON());
    }

    toJSON() {
        return {
            primary: this.primary,
            column: this.column
        }
    }

}