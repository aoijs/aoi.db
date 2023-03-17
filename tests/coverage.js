const b = require("benny");
const { KeyValue } = require("../dist/cjs/index.js");
const db = new KeyValue({
    path: "./database/", //path of the database
    tables: ["main"], // TableName[]
    methodOption: {
        saveTime: 100, // queue time to flush data into file
        deleteTime: 500, // queue time to delete data from file
    },
    encryptOption: {
        securitykey: "a-32-characters-long-string-here", //32 bit long securityKey for encrypting (this is 32 characters long too ;) )
        enabled: false, //enabling encryption
    },
});

db.on("ready", () => {
    console.log(`Database is Ready`);
});

db.connect();
let i = 0,j = 0;
b.suite(
    "Example",

    b.add( "set", async () =>
    {
        await db.set( "main", `key${ i }`, {value: i } );
        i++;
    } ),

    b.add( "get", async () =>
    {
        await db.get( "main", `key${ j }` );
        j++;
    } ),
    b.add( "all", async () =>
    {
        await db.all( "main" );
    } ),
    j = 0,
    b.add( "delete", async () =>
    {
        await db.delete( "main", `key${ j }` );
        j++;
    } ),


    b.cycle( ),
    b.complete(),
    b.save({ file: "reduce", version: "1.0.0" }),
    b.save({ file: "reduce", format: "chart.html" }),
);

setTimeout(() => console.log("done"), 120000);