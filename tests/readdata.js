const fs = require("fs/promises");

console.log("KeyValue");

fs.readdir("./database/main/").then((d) => {
  d.forEach((f) => {
    fs.readFile(`./database/main/${f}`).then((b) => {
      console.log(`${f} -> ${b.byteLength} bytes`);
    });
  });
});

console.log("WideColumn");

fs.readdir("./columndatabase/main/").then((d) => {
  d.forEach((f) => {
    fs.readdir(`./columndatabase/main/${f}`).then((files) => {
      files.forEach((file) => {
        fs.readFile(`./columndatabase/main/${f}/${file}`).then((b) => {
          console.log(`${file} -> ${b.byteLength} bytes`);
        });
      });
    });
  });
});
