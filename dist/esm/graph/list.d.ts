export declare class List<T extends "node" | "list"> {
    data: List<T>;
    next: List<T> | null;
    constructor(type: T);
}
//# sourceMappingURL=list.d.ts.map