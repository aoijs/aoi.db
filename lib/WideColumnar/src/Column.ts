import { WideColumnarColumnOptions } from "../typings/interface.js";
import { ColumnType } from "../typings/types.js";

export default class WideColumnarColumn {
    name: string;
    primaryKey: boolean;
    default: any;
    type: ColumnType;
    constructor(options: WideColumnarColumnOptions) {
        this.name = options.name;
        this.primaryKey = options.primaryKey;
        this.default = options.default;
        this.type = options.type;

        if(!this.primaryKey && this.default === undefined)
            throw new Error("Default value is required for non primary key columns");
        
    }


}