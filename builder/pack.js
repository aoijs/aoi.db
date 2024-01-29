const fs = require("fs");

fs.writeFileSync("./dist/cjs/package.json",JSON.stringify({
    "type": "commonjs",
},null,4));

fs.writeFileSync("./dist/esm/package.json",JSON.stringify({
    "type": "module",
},null,4));