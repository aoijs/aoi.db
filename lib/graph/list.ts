import { ListData } from "../typings/interface";

export class List<T extends "node" | "list"> {
    data: List<T>;
    next: List<T> | null;
    constructor(type:T) {
        this.data = new List("node");
        this.next = null;
    }
}