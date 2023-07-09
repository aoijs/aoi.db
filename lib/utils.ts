import { createCipheriv,createDecipheriv,randomBytes } from "crypto";
import { Hash } from "./typings/interface";
const algorithm = "aes-256-cbc";
export function encrypt(string: string, key: string,iV?:string):Hash {
    const iv = iV? Buffer.from(iV) : randomBytes(16);
    const cipher = createCipheriv(algorithm, key, iv);

    const encrypted = Buffer.concat([cipher.update(string), cipher.final()]);
    return {
        iv: iv.toString("hex"),
        encrypted: encrypted.toString("hex"),
    };
}

export function decrypt(hash:Hash, key: string) {
    const decipher = createDecipheriv(
        algorithm,
        key,
        Buffer.from(hash.iv, "hex")
    );

    const decrpyted = Buffer.concat([
        decipher.update(Buffer.from(hash.encrypted, "hex")),
        decipher.final(),
    ]);

    return decrpyted.toString();
}

export const ReferenceConstantSpace = "�".repeat(5);
export function createHashRawString(strings:string[]) {
    return strings.join(ReferenceConstantSpace);
}

export function  createHash(string:string,key:string,iv:string) {
    return encrypt(string,key,iv).encrypted
}

export function decodeHash(hash:string,key:string,iv:string) {
    const decrpyted = decrypt({encrypted:hash,iv:iv},key);
    return decrpyted.split(ReferenceConstantSpace);
}