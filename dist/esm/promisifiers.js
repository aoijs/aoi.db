import fs from "node:fs";
import { promisify } from "node:util";
export const read = promisify(fs.read);
export const write = promisify(fs.write);
export const open = promisify(fs.open);
export const close = promisify(fs.close);
// all fs methods that uses fd 
export const fstat = promisify(fs.fstat);
export const fdatasync = promisify(fs.fdatasync);
export const ftruncate = promisify(fs.ftruncate);
export const fsync = promisify(fs.fsync);
export const freadv = promisify(fs.readv);
export const fwritev = promisify(fs.writev);
export const futimes = promisify(fs.futimes);
export const fchmod = promisify(fs.fchmod);
export const fchown = promisify(fs.fchown);
//# sourceMappingURL=promisifiers.js.map