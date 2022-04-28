"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransmitterOp = exports.ReceiverOp = exports.TransmitterFlags = exports.DatabaseEvents = void 0;
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
    ReceiverOp["ACK_CONNECTION"] = "ackConnection";
    ReceiverOp["ACK_SET"] = "ackSet";
    ReceiverOp["ACK_GET"] = "ackGet";
    ReceiverOp["ACK_DELETE"] = "ackDelete";
    ReceiverOp["ACK_ALL"] = "ackAll";
    ReceiverOp["ACK_PING"] = "ackPing";
    ReceiverOp["ACK_TABLES"] = "ackTables";
    ReceiverOp["ACK_COLUMNS"] = "ackColumns";
    ReceiverOp["ACK_ROWS"] = "ackRows";
    ReceiverOp["ERROR"] = "error";
    ReceiverOp["ACK_CACHE"] = "ackCache";
})(ReceiverOp = exports.ReceiverOp || (exports.ReceiverOp = {}));
var TransmitterOp;
(function (TransmitterOp) {
    TransmitterOp["REQUEST"] = "request";
    TransmitterOp["SET"] = "set";
    TransmitterOp["GET"] = "get";
    TransmitterOp["DELETE"] = "delete";
    TransmitterOp["ALL"] = "all";
    TransmitterOp["PING"] = "ping";
    TransmitterOp["LOGS"] = "logs";
    TransmitterOp["TABLES"] = "tables";
    TransmitterOp["COLUMNS"] = "columns";
    TransmitterOp["ROWS"] = "rows";
    TransmitterOp["REQUEST_CACHE"] = "requestCache";
    TransmitterOp["CONNECTION"] = "connection";
    TransmitterOp["TABLE_OPEN"] = "tableOpen";
    TransmitterOp["TABLE_CLOSE"] = "tableClose";
    TransmitterOp["COLUMN_OPEN"] = "columnOpen";
    TransmitterOp["COLUMN_CLOSE"] = "columnClose";
    TransmitterOp["ROW_OPEN"] = "rowOpen";
    TransmitterOp["ROW_CLOSE"] = "rowClose";
    TransmitterOp["BULK_TABLE_OPEN"] = "bulkTableOpen";
    TransmitterOp["BULK_TABLE_CLOSE"] = "bulkTableClose";
    TransmitterOp["BULK_COLUMN_OPEN"] = "bulkColumnOpen";
    TransmitterOp["BULK_COLUMN_CLOSE"] = "bulkColumnClose";
    TransmitterOp["BULK_ROW_OPEN"] = "bulkRowOpen";
    TransmitterOp["BULK_ROW_CLOSE"] = "bulkRowClose";
})(TransmitterOp = exports.TransmitterOp || (exports.TransmitterOp = {}));
//# sourceMappingURL=enums.js.map