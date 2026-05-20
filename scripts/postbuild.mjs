import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const ensureJs = (relativeMjs, relativeJs) => {
    const mjs = resolve(root, relativeMjs);
    const js = resolve(root, relativeJs);
    if (existsSync(mjs) && !existsSync(js)) {
        copyFileSync(mjs, js);
    }
};

ensureJs("dist/index/index.mjs", "dist/index/index.js");
ensureJs("dist/math/index.mjs", "dist/math/index.js");
