import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
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
//# sourceMappingURL=utils.js.map