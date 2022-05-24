import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { createReadStream } from "fs";
import { WsDBTypes } from "../typings/enums.js";
const algorithm = "aes-256-ctr";
export function JSONParser(readData) {
    let res;
    try {
        res = JSON.parse(readData);
    }
    catch {
        const index = readData.lastIndexOf("}");
        readData = `${readData.slice(0, index + 1)}`;
        try {
            res = JSON.parse(readData);
        }
        catch {
            readData += "}";
            res = JSON.parse(readData);
        }
    }
    return res;
}
export function encrypt(readData, securitykey) {
    const iv = randomBytes(16);
    const cipher = createCipheriv(algorithm, securitykey, iv);
    const encrypted = Buffer.concat([cipher.update(readData), cipher.final()]);
    return {
        iv: iv.toString("hex"),
        data: encrypted.toString("hex"),
    };
}
export function decrypt(hash, securitykey) {
    const decipher = createDecipheriv(algorithm, securitykey, Buffer.from(hash.iv, "hex"));
    const decrpyted = Buffer.concat([
        decipher.update(Buffer.from(hash.data, "hex")),
        decipher.final(),
    ]);
    return decrpyted.toString();
}
export function encryptColumnData(data, securitykey, iv) {
    const cipher = createCipheriv(algorithm, securitykey, Buffer.from(iv, "hex"));
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    return encrypted.toString("hex");
}
export function decryptColumnFile(readData, iv, securitykey) {
    const decipher = createDecipheriv(algorithm, securitykey, Buffer.from(iv, "hex"));
    const decrpyted = Buffer.concat([
        decipher.update(Buffer.from(readData, "hex")),
        decipher.final(),
    ]);
    return decrpyted.toString();
}
export function stringify(data) {
    if (typeof data === "string") {
        return data;
    }
    else if (typeof data === "number") {
        return data.toString();
    }
    else if (typeof data === "boolean") {
        return data.toString();
    }
    else if (data instanceof Date) {
        return data.toISOString();
    }
    else if (typeof data === "object" &&
        !(data instanceof Buffer || data instanceof ReadableStream)) {
        return JSON.stringify(data);
    }
    else if (typeof data === "bigint") {
        return data.toString();
    }
    else if (data instanceof Buffer) {
        return data.toString("hex");
    }
    else {
        return data.toString();
    }
}
export function countFileLines(filePath) {
    return new Promise((resolve, reject) => {
        let lineCount = 0;
        createReadStream(filePath)
            .on("data", (buffer) => {
            let idx = -1;
            lineCount--; // Because the loop will run once for idx=-1
            do {
                idx = buffer.indexOf(10, idx + 1);
                lineCount++;
            } while (idx !== -1);
        })
            .on("end", () => {
            resolve(lineCount);
        })
            .on("error", reject);
    });
}
export function parseData(data, type) {
    if (type === WsDBTypes.KeyValue) {
        const value = data.value;
        const obj = {
            type: value instanceof Date ? "date" : typeof value,
            value: value?.toString(),
        };
        return obj;
    }
    else if (type === WsDBTypes.WideColumn) {
        return stringify(data);
    }
}
//# sourceMappingURL=functions.js.map