export type KeyValueDataValueType =
  | string
  | bigint
  | number
  | null
  | boolean
  | Array<KeyValueDataValueType>
  | ValidJSON
  | Date;

export type ValidJSON = {
  [x: string | number | symbol]:
    | ValidJSON
    | number
    | string
    | Array<ValidJSON>
    | null
    | boolean
    | (unknown & { toJSON(): ValidJSON });
};
export type CacheReferenceType = "MEMORY" | "DISK";
export type WideColumnTypes =
  | "string"
  | "number"
  | "boolean"
  | "bigint"
  | "object"
  | "date"
  | "buffer"
  | "stream";
export type WideColumnDataValueType = string | number | boolean | null | Date | Buffer | bigint | object | ReadableStream;
export type RelationalDataValueType =
  | string
  | number
  | object
  | BigBuffer
  | Date
  | boolean;
export type BigBuffer = Buffer | ArrayBuffer | bigint | Blob | ReadableStream;
