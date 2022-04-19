const db = require("./db.js");

async function newdelete() {
  let i = 100000;
  if (db.options.cacheOption.cacheReference === "MEMORY") {
    while (i-- > 0) {
      await db.delete("submain", `${i}`);
    }
  } else db.clear("submain");
}
module.exports = newdelete;
