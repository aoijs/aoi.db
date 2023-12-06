import {
    createReadStream,
    createWriteStream,
    existsSync,
    readdirSync,
    truncate,
    truncateSync,
} from "fs";
import { WideColumnarColumnOptions } from "../typings/interface.js";
import { ColumnType, WideColumnarDataType } from "../typings/types.js";
import MemMap from "./MemMap.js";
import WideColumnarTable from "./Table.js";
import WideColumnarData from "./Data.js";
import { randomBytes } from "crypto";
import { readFile, writeFile } from "fs/promises";
import readline from "readline/promises";
import {
    ReferenceConstantSpace,
    createHash,
    createHashRawString,
    decrypt,
    encrypt,
    parse,
    stringify,
} from "../../utils.js";
import { Data } from "ws";
import { DatabaseMethod } from "../../index.js";

export default class WideColumnarColumn {
    name: string;
    primaryKey: boolean;
    default: any;
    type: ColumnType;
    path!: string;
    files!: string[];
    table!: WideColumnarTable;
    memMap: MemMap;
    #log!: {
        iv: string;
        writer: NodeJS.WritableStream;
        path: string;
    };
    constructor(options: WideColumnarColumnOptions) {
        this.name = options.name;
        this.primaryKey = options.primaryKey;
        this.default = options.default;
        this.type = options.type;
        this.memMap = new MemMap(
            {
                limit: this.table.db.options.cacheConfig.limit,
                sortFunction: this.table.db.options.cacheConfig.sortFunction,
            },
            this,
        );

        if (!this.primaryKey && this.default === undefined)
            throw new Error(
                "Default value is required for non primary key columns",
            );
    }

    setPath(path: string) {
        this.path = path;
    }

    setFiles() {
        this.files = this.#getFiles();
    }

    setTable(table: WideColumnarTable) {
        this.table = table;
    }

    #getFiles() {
        return readdirSync(this.path).filter((x) =>
            x.endsWith(this.table.db.options.fileConfig.extension as string),
        );
    }

    async initialize() {
        await this.#initalize();
        await this.#getLogInfo();
        await this.#syncWithLogs();
    }

    async #initalize() {
        const transactionPath = `${this.path}/transaction.log`;
        if (!existsSync(transactionPath)) {
            const IV = randomBytes(16).toString("hex");
            await writeFile(transactionPath, IV + "\n\n");
        }

        const referencePath = `${this.table.db.options.dataConfig.referencePath}/${this.table.name}/${this.name}`;
        if (!existsSync(referencePath)) {
            await writeFile(referencePath, "");
        }
        this.setFiles();
    }

    async #readIvfromLog(): Promise<string> {
        const logFile = `${this.path}/transaction.log`;

        return new Promise(async (res, rej) => {
            if (!existsSync(logFile)) {
                rej("log file not found");
            } else {
                let iv: string;

                const rs = createReadStream(logFile, {
                    highWaterMark: 33,
                    encoding: "utf8",
                    flags: "r",
                });

                rs.on("data", async (chunk: string) => {
                    iv = chunk;
                    rs.close();
                })
                    .on("error", (err) => {
                        rej(err);
                    })
                    .on("close", () => {
                        res(iv);
                    });
            }
        });
    }

    async #getLogInfo() {
        this.#log = {
            iv: await this.#readIvfromLog(),
            path: `${this.path}/transaction.log`,
            writer: createWriteStream(`${this.path}/transaction.log`, {
                flags: "a",
                encoding: "utf8",
            }),
        };
    }

    async #syncWithLogs() {
        const logFile = this.#log.path;

        const rl = readline.createInterface({
            input: createReadStream(logFile),
            crlfDelay: Infinity,
        });

        let index = 0;
        for await (const line of rl) {
            if (index < 2) {
                index++;
                continue;
            }
            const decrypted = decrypt(
                {
                    iv: this.#log.iv,
                    data: line,
                },
                this.table.db.options.encryptionConfig.securityKey,
            );

            const [columnValue, columnType, primaryValue, primaryType, method] =
                decrypted.split(ReferenceConstantSpace);
            
            const parsedMethod = Number(method.trim());
            const data = new WideColumnarData({
                column: {
                    name: this.name,
                    type: columnType as ColumnType,
                    value: parse(columnValue, columnType as ColumnType),
                },
                primary: {
                    name: this.table.primary.name,
                    type: this.table.primary.type,
                    value: parse(primaryValue, primaryType as ColumnType),
                },
            });

            if (parsedMethod === DatabaseMethod.Set) {
                this.memMap.set(data);
            } else if (parsedMethod === DatabaseMethod.Delete) {
                this.memMap.delete(data.column.name, data.primary.value);
            }
        }

        await this.#createNewLogCycle();
    }

    async #createNewLogCycle(): Promise<void> {
        return new Promise((res, rej) => {
            this.#log.writer.end(() => {
                const IV = randomBytes(16).toString("hex");
                truncateSync(this.#log.path);
                this.#log.iv = IV;
                this.#log.writer = createWriteStream(this.#log.path, {
                    flags: "a",
                    encoding: "utf8",
                });
                this.#log.writer.write(IV + "\n\n", () => {
                    res();
                });
            });
        });
    }

    async #wal(data: WideColumnarData, method: DatabaseMethod) {
        const json = data.toJSON();

        const delimitedString = createHashRawString([
            stringify(json.column.value),
            json.column.type,
            stringify(json.primary.value),
            json.primary.type,
            method?.toString(),
        ]);

        const hash = createHash(
            delimitedString,
            this.table.db.options.encryptionConfig.securityKey,
            this.#log.iv,
        );
        this.#log.writer.write(hash + "\n");
    }



    async #flush(data: WideColumnarData[]) {
        return new Promise(async (res, rej) => {
            const path = `${this.path}/${this.name}_${Date.now()}.json`;
        });
        
    }

    set(primary: WideColumnarDataType, value: WideColumnarDataType) {
        const data = new WideColumnarData({
            column: {
                name: this.name,
                type: this.type,
                value: value,
            },
            primary: {
                name: this.table.primary.name,
                type: this.table.primary.type,
                value: primary,
            },
        });

        this.memMap.set(data);
    }
}
