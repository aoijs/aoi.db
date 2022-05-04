const fs = require("fs/promises");

async function f() {
await fs.readdir("./database/main/").then((d) => {
  d.forEach((f) => {
    fs.readFile(`./database/main/${f}`).then((b) => {
      console.log(`KeyValue : ${f} -> ${b.byteLength} bytes`);
    });
  });
});

await
fs.readdir("./columndatabase/main/").then((d) => {
  d.forEach((f) => {
    fs.readdir(`./columndatabase/main/${f}`).then((files) => {
      files.forEach((file) => {
        fs.readFile(`./columndatabase/main/${f}/${file}`).then((b) => {
      console.log(`WideColumn : ${file} -> ${b.byteLength} bytes`);
        });
      });
    });
  });
});
}
f();