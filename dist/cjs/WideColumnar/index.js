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
exports.MemMap = exports.Referencer = exports.WideColumnarTable = exports.WideColumnarData = exports.WideColumnarColumn = exports.WideColumnar = void 0;
const Database_js_1 = __importDefault(require("./src/Database.js"));
exports.WideColumnar = Database_js_1.default;
const Column_js_1 = __importDefault(require("./src/Column.js"));
exports.WideColumnarColumn = Column_js_1.default;
const Data_js_1 = __importDefault(require("./src/Data.js"));
exports.WideColumnarData = Data_js_1.default;
const Table_js_1 = __importDefault(require("./src/Table.js"));
exports.WideColumnarTable = Table_js_1.default;
const Referencer_js_1 = __importDefault(require("./src/Referencer.js"));
exports.Referencer = Referencer_js_1.default;
const MemMap_js_1 = __importDefault(require("./src/MemMap.js"));
exports.MemMap = MemMap_js_1.default;
__exportStar(require("./typings/interface.js"), exports);
__exportStar(require("./typings/types.js"), exports);
//# sourceMappingURL=index.js.map