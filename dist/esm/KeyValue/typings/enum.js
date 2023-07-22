export var CacheType;
(function (CacheType) {
    CacheType[CacheType["LRU"] = 0] = "LRU";
    CacheType[CacheType["MRU"] = 1] = "MRU";
    CacheType[CacheType["LFU"] = 2] = "LFU";
    CacheType[CacheType["MFU"] = 3] = "MFU";
    CacheType[CacheType["FIFO"] = 4] = "FIFO";
    CacheType[CacheType["FILO"] = 5] = "FILO";
})(CacheType || (CacheType = {}));
export var DatabaseMethod;
(function (DatabaseMethod) {
    DatabaseMethod[DatabaseMethod["Set"] = 0] = "Set";
    //Get,
    DatabaseMethod[DatabaseMethod["Delete"] = 1] = "Delete";
    DatabaseMethod[DatabaseMethod["Flush"] = 2] = "Flush";
    DatabaseMethod[DatabaseMethod["Clear"] = 3] = "Clear";
    DatabaseMethod[DatabaseMethod["Replicate"] = 4] = "Replicate";
    DatabaseMethod[DatabaseMethod["Backup"] = 5] = "Backup";
    DatabaseMethod[DatabaseMethod["Restore"] = 6] = "Restore";
    DatabaseMethod[DatabaseMethod["NewFile"] = 7] = "NewFile";
})(DatabaseMethod || (DatabaseMethod = {}));
export var DatabaseEvents;
(function (DatabaseEvents) {
    DatabaseEvents["Connect"] = "connect";
    DatabaseEvents["Error"] = "error";
    DatabaseEvents["Set"] = "set";
    DatabaseEvents["Get"] = "get";
    DatabaseEvents["Delete"] = "delete";
    DatabaseEvents["Flush"] = "flush";
    DatabaseEvents["Clear"] = "clear";
    DatabaseEvents["Replicate"] = "replicate";
    DatabaseEvents["Backup"] = "backup";
    DatabaseEvents["Restore"] = "restore";
    DatabaseEvents["Disconnect"] = "disconnect";
    DatabaseEvents["TableReady"] = "tableReady";
})(DatabaseEvents || (DatabaseEvents = {}));
export var ReferenceType;
(function (ReferenceType) {
    ReferenceType[ReferenceType["Cache"] = 0] = "Cache";
    ReferenceType[ReferenceType["File"] = 1] = "File";
})(ReferenceType || (ReferenceType = {}));
//# sourceMappingURL=enum.js.map