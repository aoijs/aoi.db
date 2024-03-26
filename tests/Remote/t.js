const { Transmitter } = require("../../dist/cjs/index.js");
const  {ReceiverOpCodes,Receiver,DatabaseEvents, Permissions} = require("../../dist/cjs/index.js");
const receiver = new Receiver({
    host: 'localhost',
    port: 8080,
    backlog: 1024,
    databaseType: 'KeyValue',
    databaseOptions: {
        dataConfig: {
            path: "./database/",
            tables: ['contributors'],
        },
        encryptionConfig: {
            securityKey: 'a-32-characters-long-string-here'
        }
    },
    userConfig: [{
        username: 'usersatoshi',
        password: '123456',
        permissions: Permissions.RW,
    }]
});


receiver.allowAddress("*");

receiver.on(DatabaseEvents.Connect, () => console.log("Server Is Ready"));

receiver.on(DatabaseEvents.Debug, (data) => console.log(data));

receiver.on(DatabaseEvents.Data , (data) => console.log(data));

receiver.connect();


const tr = Transmitter.createConnection({
    path: `aoidb://usersatoshi:123456@localhost:8080`,
})




tr.on(DatabaseEvents.Connect, () => console.log("Connected"));

tr.on(DatabaseEvents.Debug, (data) => console.log(data));

tr.on(DatabaseEvents.Disconnect, (d) => console.log("Disconnected",d));

tr.on(DatabaseEvents.Data , (data) => console.log(data));

tr.connect();
setInterval(() => {
console.log("dbPing: ",tr.data.ping)
}, 5000);