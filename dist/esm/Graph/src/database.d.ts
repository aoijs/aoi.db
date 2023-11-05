/// <reference types="node" />
import EventEmitter from "events";
import { GrpahDBConfig } from "../typings/interface.js";
import { DeepRequired } from "../../index.js";
import Table from "./table.js";
export default class GraphDB extends EventEmitter {
    #private;
    tables: Record<string, {
        table: Table;
        ready: boolean;
    }>;
    readyAt: number;
    constructor(options: GrpahDBConfig);
    static defaultOptions(): DeepRequired<GrpahDBConfig>;
    get options(): DeepRequired<GrpahDBConfig>;
    connect(): Promise<void>;
}
//# sourceMappingURL=database.d.ts.map