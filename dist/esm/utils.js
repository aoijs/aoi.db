"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parse = exports.stringify = exports.returnParseString = exports.parseTransmitterQuery = exports.convertV1KeyValuetov2 = exports.JSONParser = exports.decodeHash = exports.createHash = exports.createHashRawString = exports.ReferenceConstantSpace = exports.decrypt = exports.encrypt = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const algorithm = "aes-256-ctr";
//@ts-ignore
const jsonrepair_1 = require("jsonrepair");
function encrypt(string, key, iV) {
    const iv = iV ? Buffer.from(iV, "hex") : (0, crypto_1.randomBytes)(16);
    const cipher = (0, crypto_1.createCipheriv)(algorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(string), cipher.final()]);
    return {
        iv: iv.toString("hex"),
        data: encrypted.toString("hex"),
    };
}
exports.encrypt = encrypt;
function decrypt(hash, key) {
    const decipher = (0, crypto_1.createDecipheriv)(algorithm, key, Buffer.from(hash.iv, "hex"));
    const decrpyted = Buffer.concat([
        decipher.update(Buffer.from(hash.data, "hex")),
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
    return encrypt(string, key, iv).data;
}
exports.createHash = createHash;
function decodeHash(hash, key, iv) {
    const decrpyted = decrypt({ data: hash, iv: iv }, key);
    return decrpyted.split(exports.ReferenceConstantSpace);
}
exports.decodeHash = decodeHash;
function JSONParser(data) {
    try {
        return {
            data: JSON.parse(data),
            isBroken: false,
        };
    }
    catch (e) {
        try {
            return {
                data: (0, jsonrepair_1.jsonrepair)(data),
                isBroken: true,
            };
        }
        catch (e) {
            data = data.split("}").slice(0, -1).join("}").trim();
            if (!data.endsWith("}"))
                data += "}}";
            else
                data += "}";
            if (data === "}" || data === "}}")
                return {
                    data: {},
                    isBroken: true,
                };
            return {
                data: JSON.parse(data),
                isBroken: true,
            };
        }
    }
}
exports.JSONParser = JSONParser;
async function convertV1KeyValuetov2(oldDbFolder, db) {
    const tables = (0, fs_1.readdirSync)(oldDbFolder);
    for (const table of tables) {
        if (!db.tables[table])
            continue;
        const files = (0, fs_1.readdirSync)(oldDbFolder + "/" + table).filter((x) => !x.startsWith("$temp_"));
        for (const file of files) {
            const data = (0, fs_1.readFileSync)(oldDbFolder + "/" + table + "/" + file).toString();
            const { data: json, isBroken } = JSONParser(data);
            if (json.iv && json.data) {
                json.ecrypted = json.data;
                delete json.data;
                const { data: decrypted } = JSONParser(decrypt(json, db.options.encryptionConfig.securityKey));
                const keys = Object.keys(decrypted);
                for (const key of keys) {
                    await db.set(table, key, decrypted[key]);
                }
            }
            else {
                const keys = Object.keys(json);
                for (const key of keys) {
                    await db.set(table, key, json[key]);
                }
            }
        }
    }
}
exports.convertV1KeyValuetov2 = convertV1KeyValuetov2;
function parseTransmitterQuery(query) {
    const str = returnParseString("&&", query, "===", "&&");
    return new Function(" return (Data) => " + str)();
}
exports.parseTransmitterQuery = parseTransmitterQuery;
function returnParseString(key, value, sign = "===", join = "&&") {
    if (key === "value" || key === "key" || key === "ttl") {
        if (sign === "$sw") {
            return `Data.${key}.startsWith(${value})`;
        }
        if (sign === "$ew") {
            return `Data.${key}.endsWith(${value})`;
        }
        if (sign === "$i") {
            return `Data.${key}.includes(${value})`;
        }
        if (sign === "$re") {
            return `Data.${key}.match(${value})`;
        }
        return `Data.${key} ${sign} ${value}`;
    }
    if (key === "=") {
        const keys = Object.keys(value);
        return keys
            .map((x) => returnParseString(x, value[x], "===", join))
            .join(join);
    }
    if (key === "!=") {
        const keys = Object.keys(value);
        return keys
            .map((x) => returnParseString(x, value[x], "!==", join))
            .join(join);
    }
    if (key === ">") {
        const keys = Object.keys(value);
        return keys
            .map((x) => returnParseString(x, value[x], ">", join))
            .join(join);
    }
    if (key === "<") {
        const keys = Object.keys(value);
        return keys
            .map((x) => returnParseString(x, value[x], "<", join))
            .join(join);
    }
    if (key === ">=") {
        const keys = Object.keys(value);
        return keys
            .map((x) => returnParseString(x, value[x], ">=", join))
            .join(join);
    }
    if (key === "<=") {
        const keys = Object.keys(value);
        return keys
            .map((x) => returnParseString(x, value[x], "<=", join))
            .join(join);
    }
    if (key === "$sw") {
        const keys = Object.keys(value);
        return keys
            .map((x) => returnParseString(x, value[x], "$sw", join))
            .join(join);
    }
    if (key === "$ew") {
        const keys = Object.keys(value);
        return keys
            .map((x) => returnParseString(x, value[x], "$ew", join))
            .join(join);
    }
    if (key === "$i") {
        const keys = Object.keys(value);
        return keys
            .map((x) => returnParseString(x, value[x], "$i", join))
            .join(join);
    }
    if (key === "$re") {
        const keys = Object.keys(value);
        return keys
            .map((x) => returnParseString(x, value[x], "$re", join))
            .join(join);
    }
    if (key === "||") {
        const keys = Object.keys(value);
        return keys
            .map((x) => returnParseString(x, value[x], "===", join))
            .join("||");
    }
    if (key === "&&") {
        const keys = Object.keys(value);
        return keys
            .map((x) => returnParseString(x, value[x], "===", join))
            .join("&&");
    }
    return "";
}
exports.returnParseString = returnParseString;
function stringify(data) {
    if (typeof data === "string")
        return data;
    if (typeof data === "undefined")
        return "undefined";
    if (typeof data === "object")
        return JSON.stringify(data);
    if (data === null)
        return "null";
    if (data instanceof Date)
        return data.toISOString();
    return data.toString();
}
exports.stringify = stringify;
function parse(data, type) {
    if (type === "string")
        return data;
    if (type === "undefined")
        return undefined;
    if (type === "null")
        return null;
    if (type === "object")
        return JSON.parse(data);
    if (type === "number")
        return Number(data);
    if (type === "boolean")
        return Boolean(data);
    if (type === "bigint")
        return BigInt(data);
    if (type === "date")
        return new Date(data);
    return data;
}
exports.parse = parse;
//# sourceMappingURL=utils.js.map