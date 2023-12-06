"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class WideColumnar {
    options;
    constructor(options) {
        this.options = this.#finalizeOptions(options);
    }
    static defaultOptions = {
        dataConfig: {
            path: "./database",
            tables: [{
                    name: "main",
                    columns: [{
                            name: "id",
                            primaryKey: true,
                            default: "0",
                            type: "string"
                        }, {
                            name: "var",
                            primaryKey: false,
                            default: "0",
                            type: "string"
                        }]
                }],
            referencePath: "./reference",
        },
        cacheConfig: {
            limit: 20 * 1024 * 1024,
            sortFunction: (a, b) => {
                if (a.column && a.column.value && b.column && b.column.value) {
                    return a.column.value > b.column.value ? 1 : -1;
                }
                return 0;
            }
        },
        encryptionConfig: {
            securityKey: "a-32-characters-long-string-here"
        },
        fileConfig: {
            extension: ".wcd",
        },
        debug: false
    };
    #finalizeOptions(options) {
        const defaultOptions = WideColumnar.defaultOptions;
        return {
            dataConfig: {
                path: options.dataConfig?.path || defaultOptions.dataConfig.path,
                tables: options.dataConfig?.tables || defaultOptions.dataConfig.tables,
                referencePath: options.dataConfig?.referencePath || defaultOptions.dataConfig.referencePath,
            },
            cacheConfig: {
                limit: options.cacheConfig?.limit || defaultOptions.cacheConfig.limit,
                sortFunction: options.cacheConfig?.sortFunction || defaultOptions.cacheConfig.sortFunction,
            },
            encryptionConfig: {
                securityKey: options.encryptionConfig?.securityKey || defaultOptions.encryptionConfig.securityKey,
            },
            fileConfig: {
                extension: options.fileConfig?.extension || defaultOptions.fileConfig.extension,
            },
            debug: options.debug || defaultOptions.debug,
        };
    }
}
exports.default = WideColumnar;
//# sourceMappingURL=Database.js.map