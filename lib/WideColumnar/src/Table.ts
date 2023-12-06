import { WideColumnarColumnOptions, WideColumnarTableOptions } from "../typings/interface.js";
import { ColumnType } from "../typings/types.js";
import WideColumnarColumn from "./Column.js";
import WideColumnar from "./Database.js";

export default class WideColumnarTable {
    name: string;
    columns!: WideColumnarColumn[];
    #db: WideColumnar;
    #primary!: {
        name: string;
        type: ColumnType;
    } 
    constructor(options: WideColumnarTableOptions) {
        this.name = options.name;
        this.#parseColumns(options.columns);
        this.#db = options.db;
    }

    #parseColumns(columns: WideColumnarColumnOptions[] | WideColumnarColumn[]) {
        for(const column of columns) {
            if(!(column instanceof WideColumnarColumn)) {
                const col = new WideColumnarColumn(column);
                col.setTable(this);
                this.columns.push(col);
                if(col.primaryKey ) {
                    if(this.#primary) {
                        throw new Error("Multiple primary keys are not allowed");
                    }
                    this.#primary = {
                        name: col.name,
                        type: col.type,
                    
                    }
                }
            }
        }
    }

    get db() {
        return this.#db;
    }

    get primary() {
        return this.#primary;
    }


}