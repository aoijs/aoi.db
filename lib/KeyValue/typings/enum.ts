export enum CacheReferenceType {
    LRU ,
    MRU ,
    LFU ,
    MFU ,
    FIFO ,
    FILO ,
}

export enum DatabaseMethod {
    Set,
    //Get,
    Delete,
    Flush,
    Clear,
    Replicate,
    Backup,
    Restore,
}

export enum DatabaseEvents {
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
}
