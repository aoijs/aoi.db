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
    NewFile = 7,
    Ping = 8,
    Get = 9,
    All = 10,
    Has = 11,
    NOOP = 12,
    FindOne = 13,
    FindMany = 14,
    DeleteMany = 15,
    Analyze = 16
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
    TableReady = "tableReady",
    Debug = "debug",
    Connection = "connection",
    Data = "data"
}
export declare enum ReferenceType {
    Cache = 0,
    File = 1
}
//# sourceMappingURL=enum.d.ts.map