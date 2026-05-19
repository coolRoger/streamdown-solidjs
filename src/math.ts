"use client";

import "./math.css";

export type { MathPlugin, MathPluginOptions } from "./plugins/math";
export {
    createMathPlugin,
    math,
    math as StreamdownSolidMath,
} from "./plugins/math";
