export default class WideColumnarData {
    primary;
    column;
    constructor(data) {
        this.primary = data.primary;
        this.column = data.column;
    }
    toString() {
        return JSON.stringify(this.toJSON());
    }
    toJSON() {
        return {
            primary: this.primary,
            column: this.column
        };
    }
}
//# sourceMappingURL=Data.js.map