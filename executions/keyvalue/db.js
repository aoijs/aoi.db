const { KeyValue } = require( "../../dist/cjs/index.js" );

const db = new KeyValue({
    tables:["main","submain"],
    methodOption: {
        saveTime: 100,
        deleteTime: 1000,
        allTime:20000,
        getTime:20000,
    },
    encryptOption:{
        securitykey: "a-32-characters-long-string-here",
        enabled: true,
    },
});
db.connect();
module.exports = db;