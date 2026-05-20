import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const tmpDir = join(rootDir, ".tmp");
const smokeDir = join(tmpDir, "pack-smoke");
const shouldServe = process.argv.includes("--serve");

const run = (command, cwd = rootDir, capture = false) =>
    execSync(command, {
        cwd,
        stdio: capture ? "pipe" : "inherit",
        encoding: "utf8",
    });

const ensureCleanDir = (dir) => {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
};

const getPackedTarballName = () => {
    const output = run("pnpm pack --pack-destination .tmp", rootDir, true);
    const lines = output
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    const fileLine = lines.findLast((line) => line.endsWith(".tgz"));
    if (!fileLine) {
        throw new Error(`Cannot find packed tarball name. Output:\n${output}`);
    }
    return basename(fileLine);
};

const writeSmokeProject = (tarballName) => {
    const packageJson = {
        name: "streamdown-pack-smoke",
        private: true,
        type: "module",
        scripts: {
            dev: "vite --host 127.0.0.1 --port 4174 --strictPort",
            build: "vite build",
        },
        dependencies: {
            "solid-js": "^1.9.12",
            "streamdown-solidjs": `file:../${tarballName}`,
        },
        devDependencies: {
            typescript: "^5.4.5",
            vite: "^5.2.11",
            "vite-plugin-solid": "^2.10.2",
        },
    };

    const viteConfig = `import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
    plugins: [solidPlugin()],
});
`;

    const tsconfig = `{
    "compilerOptions": {
        "target": "ESNext",
        "module": "ESNext",
        "moduleResolution": "bundler",
        "jsx": "preserve",
        "jsxImportSource": "solid-js",
        "types": ["vite/client"],
        "strict": true
    }
}
`;

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>pack smoke</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

    const mainTsx = `import { render } from "solid-js/web";
import { StreamdownSolid } from "streamdown-solidjs";
import "streamdown-solidjs/styles.css";
import { createMathPlugin } from "streamdown-solidjs/math";
import "streamdown-solidjs/math.css";

const math = createMathPlugin({ singleDollarTextMath: true });

const App = () => (
    <StreamdownSolid isAnimating animated plugins={{ math }}>
        {"# Smoke Test\\n\\nInline: $x^2$\\n\\nBlock:\\n\\n$$\\\\int_0^1 x^2\\\\,dx = \\\\frac{1}{3}$$"}
    </StreamdownSolid>
);

render(() => <App />, document.getElementById("root")!);
`;

    mkdirSync(join(smokeDir, "src"), { recursive: true });
    writeFileSync(
        join(smokeDir, "package.json"),
        `${JSON.stringify(packageJson, null, 2)}\n`,
    );
    writeFileSync(join(smokeDir, "vite.config.ts"), viteConfig);
    writeFileSync(join(smokeDir, "tsconfig.json"), tsconfig);
    writeFileSync(join(smokeDir, "index.html"), html);
    writeFileSync(join(smokeDir, "src/main.tsx"), mainTsx);
};

const main = () => {
    ensureCleanDir(tmpDir);
    run("pnpm build");
    const tarballName = getPackedTarballName();

    ensureCleanDir(smokeDir);
    writeSmokeProject(tarballName);

    run("pnpm install", smokeDir);
    run("pnpm build", smokeDir);

    if (shouldServe) {
        run("pnpm dev", smokeDir);
        return;
    }

    console.log(`Smoke build passed: ${smokeDir}`);
    console.log("Run with --serve to start dev server for browser validation.");
};

main();
