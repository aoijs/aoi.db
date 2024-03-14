import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { Hash } from "./typings/interface.js";
import { r } from "tar";
import { KeyValue } from "./KeyValue/index.js";
import { readFileSync, readdirSync } from "fs";
import { TransmitterQuery } from "./Remote/typings/type.js";
const algorithm = "aes-256-ctr";
//@ts-ignore
import { jsonrepair } from "jsonrepair";
import { ColumnType } from "./WideColumnar/typings/types.js";
export function encrypt(string: string, key: string, iV?: string): Hash {
  const iv = iV ? Buffer.from(iV, "hex") : randomBytes(16);
  const cipher = createCipheriv(algorithm, key, iv);

  const encrypted = Buffer.concat([cipher.update(string), cipher.final()]);
  return {
    iv: iv.toString("hex"),
    data: encrypted.toString("hex"),
  };
}

export function decrypt(hash: Hash, key: string) {
  const decipher = createDecipheriv(
    algorithm,
    key,
    Buffer.from(hash.iv, "hex")
  );

  const decrpyted = Buffer.concat([
    decipher.update(Buffer.from(hash.data, "hex")),
    decipher.final(),
  ]);

  return decrpyted.toString();
}

export const ReferenceConstantSpace = "�".repeat(5);
export function createHashRawString(strings: string[]) {
  return strings.join(ReferenceConstantSpace);
}

export function createHash(string: string, key: string, iv: string) {
  return encrypt(string, key, iv).data;
}

export function decodeHash(hash: string, key: string, iv: string) {
  const decrpyted = decrypt({ data: hash, iv: iv }, key);
  return decrpyted.split(ReferenceConstantSpace);
}

export function JSONParser(data: string) {
  try {
    return {
      data: JSON.parse(data),
      isBroken: false,
    };
  } catch (e) {
    try {
      return {
        data: jsonrepair(data),
        isBroken: true,
      };
    } catch (e) {
      data = data.split("}").slice(0, -1).join("}").trim();
      if (!data.endsWith("}")) data += "}}";
      else data += "}";
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

export async function convertV1KeyValuetov2(oldDbFolder: string, db: KeyValue) {
  const tables = readdirSync(oldDbFolder);
  for (const table of tables) {
    if (!db.tables[table]) continue;
    const files = readdirSync(oldDbFolder + "/" + table).filter(
      (x) => !x.startsWith("$temp_")
    );

    for (const file of files) {
      const data = readFileSync(
        oldDbFolder + "/" + table + "/" + file
      ).toString();
      const { data: json, isBroken } = JSONParser(data);
      if (json.iv && json.data) {
        json.ecrypted = json.data;
        delete json.data;
        const { data: decrypted } = JSONParser(
          decrypt(json, db.options.encryptionConfig.securityKey)
        );

        const keys = Object.keys(decrypted);
        for (const key of keys) {
          await db.set(table, key, decrypted[key]);
        }
      } else {
        const keys = Object.keys(json);
        for (const key of keys) {
          await db.set(table, key, json[key]);
        }
      }
    }
  }
}

export function parseTransmitterQuery(
  query: TransmitterQuery
): (Data: any) => boolean {
  const str = returnParseString("&&", query, "===", "&&");
  return new Function(" return (Data) => " + str)();
}

export function returnParseString(
  key: string,
  value: any,
  sign = "===",
  join = "&&"
): string {
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

export function stringify(data: any) {
  if (typeof data === "string") return data;
  if (typeof data === "undefined") return "undefined";
  if (typeof data === "object") return JSON.stringify(data);
  if (data === null) return "null";
  if (data instanceof Date) return data.toISOString();
  return data.toString();
}

export function parse(data: string, type: ColumnType) {
  if (type === "string") return data;
  if (type === "undefined") return undefined;
  if (type === "null") return null;
  if (type === "object") return JSON.parse(data);
  if (type === "number") return Number(data);
  if (type === "boolean") return Boolean(data);
  if (type === "bigint") return BigInt(data);
  if (type === "date") return new Date(data);
  return data;
}
