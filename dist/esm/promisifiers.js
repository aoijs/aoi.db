"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fchown = exports.fchmod = exports.futimes = exports.fwritev = exports.freadv = exports.fsync = exports.ftruncate = exports.fdatasync = exports.fstat = exports.close = exports.open = exports.write = exports.read = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_util_1 = require("node:util");
exports.read = (0, node_util_1.promisify)(node_fs_1.default.read);
exports.write = (0, node_util_1.promisify)(node_fs_1.default.write);
exports.open = (0, node_util_1.promisify)(node_fs_1.default.open);
exports.close = (0, node_util_1.promisify)(node_fs_1.default.close);
// all fs methods that uses fd 
exports.fstat = (0, node_util_1.promisify)(node_fs_1.default.fstat);
exports.fdatasync = (0, node_util_1.promisify)(node_fs_1.default.fdatasync);
exports.ftruncate = (0, node_util_1.promisify)(node_fs_1.default.ftruncate);
exports.fsync = (0, node_util_1.promisify)(node_fs_1.default.fsync);
exports.freadv = (0, node_util_1.promisify)(node_fs_1.default.readv);
exports.fwritev = (0, node_util_1.promisify)(node_fs_1.default.writev);
exports.futimes = (0, node_util_1.promisify)(node_fs_1.default.futimes);
exports.fchmod = (0, node_util_1.promisify)(node_fs_1.default.fchmod);
exports.fchown = (0, node_util_1.promisify)(node_fs_1.default.fchown);
//# sourceMappingURL=promisifiers.js.map