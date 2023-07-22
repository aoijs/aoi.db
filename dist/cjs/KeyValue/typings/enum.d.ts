export declare enum CacheType {
    LRU = 0,
    MRU = 1,
    LFU = 2,
    MFU = 3,
    FIFO = 4,
    FILO = 5
}
export declare enum DatabaseMethod {
    Set = 0,
    Delete = 1,
    Flush = 2,
    Clear = 3,
    Replicate = 4,
    Backup = 5,
    Restore = 6,
    NewFile = 7
}
export declare enum DatabaseEvents {
    Connect = "connect",
    Error = "error",
    Set = "set",
    Get = "get",
    Delete = "delete",
    Flush = "flush",
    Clear = "clear",
    Replicate = "replicate",
    Backup = "backup",
    Restore = "restore",
    Disconnect = "disconnect",
    TableReady = "tableReady"
}
export declare enum ReferenceType {
    Cache = 0,
    File = 1
}
//# sourceMappingURL=enum.d.ts.map