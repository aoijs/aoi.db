"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONParser = exports.decodeHash = exports.createHash = exports.createHashRawString = exports.ReferenceConstantSpace = exports.decrypt = exports.encrypt = void 0;
const crypto_1 = require("crypto");
const algorithm = "aes-256-ctr";
function encrypt(string, key, iV) {
    const iv = iV ? Buffer.from(iV, "hex") : (0, crypto_1.randomBytes)(16);
    const cipher = (0, crypto_1.createCipheriv)(algorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(string), cipher.final()]);
    return {
        iv: iv.toString("hex"),
        encrypted: encrypted.toString("hex"),
    };
}
exports.encrypt = encrypt;
function decrypt(hash, key) {
    const decipher = (0, crypto_1.createDecipheriv)(algorithm, key, Buffer.from(hash.iv, "hex"));
    const decrpyted = Buffer.concat([
        decipher.update(Buffer.from(hash.encrypted, "hex")),
        decipher.final(),
    ]);
    return decrpyted.toString();
}
exports.decrypt = decrypt;
exports.ReferenceConstantSpace = "�".repeat(5);
function createHashRawString(strings) {
    return strings.join(exports.ReferenceConstantSpace);
}
exports.createHashRawString = createHashRawString;
function createHash(string, key, iv) {
    return encrypt(string, key, iv).encrypted;
}
exports.createHash = createHash;
function decodeHash(hash, key, iv) {
    const decrpyted = decrypt({ encrypted: hash, iv: iv }, key);
    return decrpyted.split(exports.ReferenceConstantSpace);
}
exports.decodeHash = decodeHash;
function JSONParser(data) {
    try {
        return {
            data: JSON.parse(data),
            isBroken: false
        };
    }
    catch (e) {
        data = data.split("}").slice(0, -1).join("}").trim() + "}";
        if (data === "}")
            return {
                data: {},
                isBroken: true
            };
        return {
            data: JSON.parse(data),
            isBroken: true
        };
    }
}
exports.JSONParser = JSONParser;
//# sourceMappingURL=utils.js.map