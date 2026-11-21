// Entry point for the csv-reader speed harness.
//
// Reads every case from <input>/cases.json, answers each with the reader in
// solve.js, and writes the answers to <output>/answers.json. The harness
// mounts the scored cases at /input and expects the answers at /output;
// MAKEFUN_INPUT_DIR and MAKEFUN_OUTPUT_DIR override those paths for local
// runs. Incremental marking is switched off before solve.js is loaded, the
// way the house baseline does it, so a long run is not interrupted by the
// marking phase.

import { setFlagsFromString } from "node:v8";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

setFlagsFromString("--no-incremental-marking");

const { run } = await import("./solve.js");

const inputDir = process.env.MAKEFUN_INPUT_DIR ?? "/input";
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

const cases = JSON.parse(readFileSync(join(inputDir, "cases.json"), "utf8"));
if (!Array.isArray(cases)) {
  throw new TypeError("cases.json must hold a JSON array of cases");
}
const answers = [];
for (const c of cases) {
  answers.push(run(c.input));
}
mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, "answers.json"), JSON.stringify(answers));
