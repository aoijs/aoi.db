import { WideColumnDataValueType, WideColumnTypes } from "../typings/type.js";
import { spaceConstant } from "./constants.js";

export class WideColumnData {
  primary: {
    name: string;
    value: WideColumnDataValueType;
    type: WideColumnTypes;
  };
  secondary: {
    name: string;
    value: WideColumnDataValueType;
    type: WideColumnTypes;
  };
  constructor({
    primaryColumnName,
    primaryColumnValue,
    primaryColumnType,
    secondaryColumnName,
    secondaryColumnValue,
    secondaryColumnType,
  }: {
    primaryColumnName: string;
    secondaryColumnName: string;
    primaryColumnValue: WideColumnDataValueType;
    secondaryColumnValue: WideColumnDataValueType;
    primaryColumnType: WideColumnTypes;
    secondaryColumnType: WideColumnTypes;
  }) {
    (this.primary = {
      name: primaryColumnName,
      value: primaryColumnValue,
      type: primaryColumnType,
    }),
      (this.secondary = {
        name: secondaryColumnName,
        value: secondaryColumnValue,
        type: secondaryColumnType,
      });
  }
  toString() {
    return `${this.primary.value
      ?.toString()
      .replaceAll(
        spaceConstant,
        "#COLUMNDATASPLITER#",
      )}${spaceConstant}${this.secondary.value
      ?.toString()
      .replaceAll(spaceConstant, "#COLUMNDATASPLITER#")}`;
  }
  toJSON() {
    return {
      primary: {
        name: this.primary.name,
        value: this.primary.value,
        type: this.primary.type,
      },
      secondary: {
        name: this.secondary.name,
        value: this.secondary.value,
        type: this.secondary.type,
      },
    };
  }
}
