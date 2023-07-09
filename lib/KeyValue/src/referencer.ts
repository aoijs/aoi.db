import { WriteStream,ReadStream, createWriteStream, createReadStream } from "fs";
import { ReferenceConstantSpace } from "../../utils.js";
import { appendFile } from "fs/promises";

export default class Referencer {
    cache: Record<string, string> = {};
    reader: ReadStream;
    #queue = [] as string[];
    #queued = false;
    #path: string;

    constructor(path: string) {
        this.reader = createReadStream(path);
        this.#path = path;
    }

    async #getReference(): Promise<Record<string, string>> {
        const reader = this.reader;
        return new Promise((resolve, reject) => {
            let data = "";
            reader.on("readable", () => {
                const chunk = reader.read();
                if (chunk) {
                    data += chunk.toString();
                }
            });
            reader.on("close", () => {
                const lines = data.split("\n");
                const reference: Record<string, string> = {};
                for (const line of lines) {
                    const [key, value] = line.split(ReferenceConstantSpace);
                    reference[key] = value;
                }
                resolve(reference);
            });
            reader.on("error", (err: any) => {
                reject(err);
            });
        });
    }

    async getReference() {
        if (Object.keys(this.cache).length === 0) {
            this.cache = await this.#getReference();
            setTimeout(() => {
                this.cache = {};
            }, 60000);
        }
        return this.cache;
    }

    async #saveReference(key: string, file: string) {
        const string = `${key}${ReferenceConstantSpace}${file}\n`;
        this.#queue.push(string);

        if (!this.#queued) {
            this.#queued = true;
            const interval = setTimeout(async () => {
                const wholeString = this.#queue.join("");
                this.#queue = [];
                await appendFile(this.#path, wholeString);
                this.#queued = false;
            }, 100);
        }
    }

    async setReference(key: string, file: string) {
        if(Object.keys(this.cache).length) this.cache[key] = file;
        await this.#saveReference(key, file);
    }
}