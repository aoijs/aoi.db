import  KeyValueData  from "./data.js";

interface setQueue {
    //@ts-ignore
    data: KeyValueData[];
    size: number;

    [key: string]: number;
}

interface DeleteQueue {
    data: {key:string,file:string}[];
    size: number;
}

export default class QueueManager {
    // @ts-ignore
    #set: setQueue = {
        data: [] as KeyValueData[],
        size: 0,
    };
    #delete: DeleteQueue = {
        data: [],
        size: 0,
    };

    add(data: KeyValueData | { key: string; file: string }) {
       if(data instanceof KeyValueData){
            this.#set.data.push(data);
            this.#set.size += data.size;
            this.#set[data.file] = (this.#set[data.file] || 0) + data.size;
        } else {
            this.#delete.data.push(data);
            this.#delete.size += data.key.length;
        }  
    }
    clear(type: "set" | "delete") {
        // @ts-ignore
        if (type === "set") this.#set = { data: [], size: 0 };
        //@ts-ignore
        else this.#delete = { data: [], size: 0 };
    }
    get<T extends "set" | "delete">(
        type: T,
    ): T extends "set" ? setQueue : DeleteQueue {
        // @ts-ignore
        if (type === "set") return this.#set;
        //@ts-ignore
        else return this.#delete;
    }
    has(type: "set" | "delete", key: string) {
        return type === "set"
            ? this.#set.data.some((data) => data.key === key)
            : this.#delete.data.some((data) => data.key === key);
    }
    remove(type: "set" | "delete", key: string) {
        if (type === "set") {
            const index = this.#set.data.findIndex((data) => data.key === key);
            if (index !== -1) {
                const data = this.#set.data.splice(index, 1)[0];
                this.#set.size -= data.size;
                this.#set[data.file] -= data.size;
            }
        } else {
            const index = this.#delete.data.findIndex((data) => data.key === key);
            if (index !== -1) {
                const data = this.#delete.data.splice(index, 1)[0];
                this.#delete.size -= data.key.length;
            }
        }
    }
    getQueueSize(type: "set" | "delete") {
        if (type == "set") return this.#set.size;
        else return this.#delete.size;
    }
}
