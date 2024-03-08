# @Akarui/aoi.db

## GuideLines

> This MD is resposible for explaining the guildlines on how aoi.db works and what each function does and why it needed


## Important Notes

### Columnar

> aoi.db will switch to columnar as main ( json prob later until we find a faster way to get and set values )

#### Setup

```js
import {  Database, DatabaseEvents } from "@akarui/aoi.db";

const CoinColumn = new Database.Columnar.Column({
    name: "msg",
    type: "str:512",
})

const IdColumn = new Database.Columnar.Column({
    name: "id",
    type: "i64",
    primary: true,
    allowNull: false,
});

const db = new Database.Columnar({
    baseConfig: {
        path: "./database/",
        tables: [{
            name: "main",
            columns: [CoinColumn,IdColumn],
        }],
        skey: "a-32-characters-long-string-here",
    },
    fileConfig: {
        splitFiles: false,
        // maxFileSize: 20*1024*1024, // file size in bytes only applicable if splitFiles is enabled
    },
})
```