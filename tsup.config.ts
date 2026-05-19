import { defineConfig } from "tsup";
import * as preset from "tsup-preset-solid";

const preset_options: preset.PresetOptions = {
    // array or single object
    entries: [
        // default entry (index)
        {
            // entries with '.tsx' extension will have `solid` export condition generated
            entry: "src/index.tsx",
            // will generate a separate development entry
            dev_entry: true,
            server_entry: true,
        },
        {
            entry: "src/math.ts",
            dev_entry: false,
            server_entry: true,
        },
    ],
    // Set to `true` to remove all `console.*` calls and `debugger` statements in prod builds
    drop_console: true,
    // Set to `true` to generate a CommonJS build alongside ESM
    // cjs: true,
};

const CI =
    process.env.CI === "true" ||
    process.env.GITHUB_ACTIONS === "true" ||
    process.env.CI === '"1"' ||
    process.env.GITHUB_ACTIONS === '"1"';

export default defineConfig((config) => {
    const watching = !!config.watch;

    const parsed_options = preset.parsePresetOptions(preset_options, watching);

    if (!watching && !CI) {
        const package_fields = preset.generatePackageExports(parsed_options);
        const stripSolidFromServerConditions = (
            conditions: Record<string, unknown>,
        ) => {
            for (const runtime of ["node", "deno", "worker"]) {
                const value = conditions[runtime];
                if (!value || typeof value !== "object") {
                    continue;
                }
                const nested = value as Record<string, unknown>;
                delete nested.solid;
                delete nested.development;
            }
        };
        const exportsField = package_fields.exports;
        if (exportsField && typeof exportsField === "object") {
            if ("node" in exportsField) {
                stripSolidFromServerConditions(exportsField);
            } else {
                for (const value of Object.values(exportsField)) {
                    if (value && typeof value === "object") {
                        stripSolidFromServerConditions(
                            value as Record<string, unknown>,
                        );
                    }
                }
            }
        }
        if (exportsField && typeof exportsField === "object") {
            const exportObj = exportsField as any;
            const needsSubpathWrapper =
                !("." in exportObj) &&
                ("import" in exportObj ||
                    "require" in exportObj ||
                    "solid" in exportObj ||
                    "node" in exportObj);

            package_fields.exports = (needsSubpathWrapper
                ? {
                      ".": exportObj,
                      "./styles.css": "./dist/index/index.css",
                  }
                : {
                      ...exportObj,
                      "./styles.css": "./dist/index/index.css",
                  }) as any;
        }

        console.log(
            `package.json: \n\n${JSON.stringify(package_fields, null, 2)}\n\n`,
        );

        // will update ./package.json with the correct export fields
        preset.writePackageJson(package_fields);
    }

    const tsupOptions = preset.generateTsupOptions(parsed_options);
    const forceBundledDeps = [
        "debug",
        "hast-util-to-jsx-runtime",
        "html-url-attributes",
        "marked",
        "rehype-harden",
        "rehype-raw",
        "rehype-sanitize",
        "remark-gfm",
        "remark-parse",
        "remark-rehype",
        "style-to-js",
        "unified",
        "inline-style-parser",
        "unist-util-visit",
        "unist-util-visit-parents",
    ];
    const forceExternalDeps = [
        "solid-js",
        "solid-js/web",
        "solid-js/h",
        "solid-js/h/jsx-runtime",
        "solid-js/store",
    ];
    const applyNoExternal = (options: any) => ({
        ...options,
        noExternal: Array.from(
            new Set([...(options.noExternal ?? []), ...forceBundledDeps]),
        ),
        external: Array.from(
            new Set([...(options.external ?? []), ...forceExternalDeps]),
        ),
    });

    return Array.isArray(tsupOptions)
        ? tsupOptions.map(applyNoExternal)
        : applyNoExternal(tsupOptions);
});
