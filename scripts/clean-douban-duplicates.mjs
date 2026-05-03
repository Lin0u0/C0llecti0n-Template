import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { dedupeCollectionData } from "../src/utils/douban-sync.mjs";

const DATA_TYPES = ["books", "movies", "series", "music"];
const DATA_DIR = join(process.cwd(), "src", "data");
const dryRun = process.argv.includes("--dry-run");

const existingData = {};
for (const type of DATA_TYPES) {
    existingData[type] = JSON.parse(await readFile(join(DATA_DIR, `${type}.json`), "utf-8"));
}

const result = dedupeCollectionData(existingData);

if (!dryRun) {
    for (const type of DATA_TYPES) {
        await writeFile(join(DATA_DIR, `${type}.json`), `${JSON.stringify(result.data[type], null, 2)}\n`, "utf-8");
    }
}

for (const type of DATA_TYPES) {
    const before = existingData[type].length;
    const after = result.data[type].length;
    console.log(`${type}: ${before} -> ${after} (${before - after} removed)`);
}

if (dryRun) {
    console.log("dry run only; no files changed");
}
