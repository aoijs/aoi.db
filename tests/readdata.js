const fs = require("fs/promises");

async function f() {
await fs.readdir("./__tests_dbs__/database/main/").then((d) => {
  d.forEach((f) => {
    fs.readFile(`./__tests_dbs__/database/main/${f}`).then((b) => {
      console.log(`KeyValue : ${f} -> ${b.byteLength} bytes`);
    });
  });
});

await
fs.readdir("./__tests_dbs__/testcolumndatabase/main/").then((d) => {
  d.forEach((f) => {
    fs.readdir(`./__tests_dbs__/testcolumndatabase/main/${f}`).then((files) => {
      files.forEach((file) => {
        fs.readFile(`./__tests_dbs__/testcolumndatabase/main/${f}/${file}`).then((b) => {
      console.log(`WideColumn : ${file} -> ${b.byteLength} bytes`);
        });
      });
    });
  });
});
}
f();