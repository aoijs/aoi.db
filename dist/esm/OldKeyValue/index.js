"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeyValue = exports.KeyValueTable = exports.KeyValueData = exports.KeyValueCacher = void 0;
const cache_js_1 = __importDefault(require("./src/cache.js"));
exports.KeyValueCacher = cache_js_1.default;
const data_js_1 = __importDefault(require("./src/data.js"));
exports.KeyValueData = data_js_1.default;
const database_js_1 = __importDefault(require("./src/database.js"));
exports.KeyValue = database_js_1.default;
const table_js_1 = __importDefault(require("./src/table.js"));
exports.KeyValueTable = table_js_1.default;
__exportStar(require("./typings/interface.js"), exports);
__exportStar(require("./typings/type.js"), exports);
//# sourceMappingURL=index.js.map