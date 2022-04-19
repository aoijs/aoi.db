import { KeyValueDataOption, KeyValueJSONOption } from "../typings/interface";
import { KeyValueDataValueType } from "../typings/type";
export declare class Data {
    value: KeyValueDataValueType;
    ttl: number;
    file: string;
    key: string;
    type: string;
    constructor(data: KeyValueDataOption);
    toJSON(): KeyValueJSONOption;
}
//# sourceMappingURL=data.d.ts.map