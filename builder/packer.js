import fs from "node:fs/promises";
import path from "node:path";

const cjsPackageJson = {
    "type": "commonjs"
    };

const esmPackageJson = {
    "type": "module"
};

const cjsPackageJsonPath = path.resolve("dist", "cjs", "package.json");
const esmPackageJsonPath = path.resolve("dist", "esm", "package.json");

await fs.writeFile(cjsPackageJsonPath, JSON.stringify(cjsPackageJson, null, 2));
await fs.writeFile(esmPackageJsonPath, JSON.stringify(esmPackageJson, null, 2));