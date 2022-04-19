import { types } from "util";
import { KeyValueDataOption, KeyValueJSONOption } from "../typings/interface";
import { KeyValueDataValueType } from "../typings/type";

export class Data {
  value: KeyValueDataValueType;
  ttl: number;
  file: string;
  key: string;
  type: string;
  constructor(data: KeyValueDataOption) {
    this.key = data.key;
    this.value =
      data.type === "date" &&
      (typeof data.value === "string" ||
        typeof data.value === "number" ||
        types.isDate(data.value))
        ? new Date(data.value)
        : data.type === "bigint" &&
          (typeof data.value === "string" || typeof data.value === "number")
        ? BigInt(data.value)
        : typeof data.value === "number" && data.value > Number.MAX_SAFE_INTEGER
        ? BigInt(data.value)
        : data.value;
    this.type =
      data.type ?? (this.value instanceof Date ? "date" : typeof this.value);
    this.ttl = data.ttl;
    this.file = data.file;
  }
  toJSON(): KeyValueJSONOption {
    return {
      value: types.isDate(this.value)
        ? this.value.toISOString()
        : typeof this.value === "bigint"
        ? this.value.toString()
        : this.value,
      type: this.type,
      key: this.key,
      ttl: this.ttl,
    };
  }
}
