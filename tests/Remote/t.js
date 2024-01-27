const { Transmitter,Receiver, DatabaseEvents } = require("../../dist/cjs/index.js");

const rec = new Receiver({
    host: "localhost",
    port: 8080,
    backlog:2000
});

rec.allowAddress("*");

rec.on(DatabaseEvents.Connect, () => console.log("Server Is Ready"));

rec.on(DatabaseEvents.Debug, (data) => console.log(data));

rec.connect();


const tr = Transmitter.createConnection({
    path: `aoidb://usersatoshi:123456@localhost:8080`,
    dbOptions: {
        type: "KeyValue",
        options: {
            dataConfig: {
                path: "database",
            },
            encryptionConfig: {
                securityKey: "a-32-characters-long-string-here"
            }
        }
    }
})




tr.on(DatabaseEvents.Connect, () => console.log("Connected"));

tr.on(DatabaseEvents.Debug, (data) => console.log(data));

tr.on(DatabaseEvents.Disconnect, () => console.log("Disconnected"));

tr.connect();
setInterval(() => {
console.log("dbPing: ",tr.data.ping)
}, 5000);