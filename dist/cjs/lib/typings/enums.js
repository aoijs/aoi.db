"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransmitterDBTypes = exports.WsDBTypes = exports.WsEventsList = exports.TransmitterOp = exports.ReceiverOp = exports.TransmitterFlags = exports.DatabaseEvents = void 0;
var DatabaseEvents;
(function (DatabaseEvents) {
    DatabaseEvents["READY"] = "ready";
    DatabaseEvents["TABLE_READY"] = "tableReady";
    DatabaseEvents["DEBUG"] = "debug";
    DatabaseEvents["DISCONNECT"] = "disconnect";
})(DatabaseEvents = exports.DatabaseEvents || (exports.DatabaseEvents = {}));
var TransmitterFlags;
(function (TransmitterFlags) {
    TransmitterFlags["READ_ONLY"] = "readOnly";
    TransmitterFlags["WRITE_ONLY"] = "writeOnly";
    TransmitterFlags["READ_WRITE"] = "readWrite";
})(TransmitterFlags = exports.TransmitterFlags || (exports.TransmitterFlags = {}));
var ReceiverOp;
(function (ReceiverOp) {
    ReceiverOp[ReceiverOp["ACK_CONNECTION"] = 0] = "ACK_CONNECTION";
    ReceiverOp[ReceiverOp["ACK_SET"] = 1] = "ACK_SET";
    ReceiverOp[ReceiverOp["ACK_GET"] = 2] = "ACK_GET";
    ReceiverOp[ReceiverOp["ACK_DELETE"] = 3] = "ACK_DELETE";
    ReceiverOp[ReceiverOp["ACK_ALL"] = 4] = "ACK_ALL";
    ReceiverOp[ReceiverOp["ACK_PING"] = 5] = "ACK_PING";
    ReceiverOp[ReceiverOp["ACK_TABLES"] = 6] = "ACK_TABLES";
    ReceiverOp[ReceiverOp["ACK_COLUMNS"] = 7] = "ACK_COLUMNS";
    ReceiverOp[ReceiverOp["ACK_ROWS"] = 8] = "ACK_ROWS";
    ReceiverOp[ReceiverOp["ERROR"] = 9] = "ERROR";
    ReceiverOp[ReceiverOp["ACK_CACHE"] = 10] = "ACK_CACHE";
    ReceiverOp[ReceiverOp["ACK_CLEAR"] = 11] = "ACK_CLEAR";
    ReceiverOp[ReceiverOp["ACK_LOGS"] = 12] = "ACK_LOGS";
    ReceiverOp[ReceiverOp["ACK_ANALYZE"] = 13] = "ACK_ANALYZE";
})(ReceiverOp = exports.ReceiverOp || (exports.ReceiverOp = {}));
var TransmitterOp;
(function (TransmitterOp) {
    TransmitterOp[TransmitterOp["REQUEST"] = 0] = "REQUEST";
    TransmitterOp[TransmitterOp["CONNECTION"] = 1] = "CONNECTION";
    TransmitterOp[TransmitterOp["TABLE_OPEN"] = 2] = "TABLE_OPEN";
    TransmitterOp[TransmitterOp["TABLE_CLOSE"] = 3] = "TABLE_CLOSE";
    TransmitterOp[TransmitterOp["COLUMN_OPEN"] = 4] = "COLUMN_OPEN";
    TransmitterOp[TransmitterOp["COLUMN_CLOSE"] = 5] = "COLUMN_CLOSE";
    TransmitterOp[TransmitterOp["ROW_OPEN"] = 6] = "ROW_OPEN";
    TransmitterOp[TransmitterOp["ROW_CLOSE"] = 7] = "ROW_CLOSE";
    TransmitterOp[TransmitterOp["BULK_TABLE_OPEN"] = 8] = "BULK_TABLE_OPEN";
    TransmitterOp[TransmitterOp["BULK_TABLE_CLOSE"] = 9] = "BULK_TABLE_CLOSE";
    TransmitterOp[TransmitterOp["BULK_COLUMN_OPEN"] = 10] = "BULK_COLUMN_OPEN";
    TransmitterOp[TransmitterOp["BULK_COLUMN_CLOSE"] = 11] = "BULK_COLUMN_CLOSE";
    TransmitterOp[TransmitterOp["BULK_ROW_OPEN"] = 12] = "BULK_ROW_OPEN";
    TransmitterOp[TransmitterOp["BULK_ROW_CLOSE"] = 13] = "BULK_ROW_CLOSE";
    TransmitterOp[TransmitterOp["SET"] = 14] = "SET";
    TransmitterOp[TransmitterOp["GET"] = 15] = "GET";
    TransmitterOp[TransmitterOp["DELETE"] = 16] = "DELETE";
    TransmitterOp[TransmitterOp["CLEAR"] = 17] = "CLEAR";
    TransmitterOp[TransmitterOp["ALL"] = 18] = "ALL";
    TransmitterOp[TransmitterOp["PING"] = 19] = "PING";
    TransmitterOp[TransmitterOp["LOGS"] = 20] = "LOGS";
    TransmitterOp[TransmitterOp["TABLES"] = 21] = "TABLES";
    TransmitterOp[TransmitterOp["COLUMNS"] = 22] = "COLUMNS";
    TransmitterOp[TransmitterOp["ROWS"] = 23] = "ROWS";
    TransmitterOp[TransmitterOp["REQUEST_CACHE"] = 24] = "REQUEST_CACHE";
    TransmitterOp[TransmitterOp["ANALYZE"] = 25] = "ANALYZE";
})(TransmitterOp = exports.TransmitterOp || (exports.TransmitterOp = {}));
var WsEventsList;
(function (WsEventsList) {
    WsEventsList["CONNECT"] = "connect";
    WsEventsList["DISCONNECT"] = "disconnect";
    WsEventsList["ERROR"] = "error";
    WsEventsList["OPEN"] = "open";
    WsEventsList["MESSAGE"] = "message";
    WsEventsList["CLOSE"] = "close";
    WsEventsList["READY"] = "ready";
})(WsEventsList = exports.WsEventsList || (exports.WsEventsList = {}));
var WsDBTypes;
(function (WsDBTypes) {
    WsDBTypes[WsDBTypes["KeyValue"] = 0] = "KeyValue";
    WsDBTypes[WsDBTypes["WideColumn"] = 1] = "WideColumn";
    WsDBTypes[WsDBTypes["Relational"] = 2] = "Relational";
})(WsDBTypes = exports.WsDBTypes || (exports.WsDBTypes = {}));
exports.TransmitterDBTypes = [
    "KeyValue",
    "WideColumn",
    "Relational",
];
//# sourceMappingURL=enums.js.map