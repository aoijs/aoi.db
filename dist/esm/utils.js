import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { readFileSync, readdirSync } from "fs";
const algorithm = "aes-256-ctr";
export function encrypt(string, key, iV) {
    const iv = iV ? Buffer.from(iV, "hex") : randomBytes(16);
    const cipher = createCipheriv(algorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(string), cipher.final()]);
    return {
        iv: iv.toString("hex"),
        encrypted: encrypted.toString("hex"),
    };
}
export function decrypt(hash, key) {
    const decipher = createDecipheriv(algorithm, key, Buffer.from(hash.iv, "hex"));
    const decrpyted = Buffer.concat([
        decipher.update(Buffer.from(hash.encrypted, "hex")),
        decipher.final(),
    ]);
    return decrpyted.toString();
}
export const ReferenceConstantSpace = "�".repeat(5);
export function createHashRawString(strings) {
    return strings.join(ReferenceConstantSpace);
}
export function createHash(string, key, iv) {
    return encrypt(string, key, iv).encrypted;
}
export function decodeHash(hash, key, iv) {
    const decrpyted = decrypt({ encrypted: hash, iv: iv }, key);
    return decrpyted.split(ReferenceConstantSpace);
}
export function JSONParser(data) {
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
export async function convertV1KeyValuetov2(oldDbFolder, db) {
    const tables = readdirSync(oldDbFolder);
    for (const table of tables) {
        if (!db.tables[table])
            continue;
        const files = readdirSync(oldDbFolder + "/" + table).filter(x => !x.startsWith("$temp_"));
        for (const file of files) {
            const data = readFileSync(oldDbFolder + "/" + table + "/" + file).toString();
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
//# sourceMappingURL=utils.js.map