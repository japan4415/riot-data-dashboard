/**
 * 画面の見た目を確かめるための、合成した開示データの zip を作る開発用の道具。
 *
 *   node scripts/make-demo-zip.ts <出力先のパス>
 */
import { writeFileSync } from "node:fs";
import { buildDemoZip } from "../tests/fixtures/demoExport.ts";

const output = process.argv[2];
if (!output) {
	console.error("使い方: node scripts/make-demo-zip.ts <出力先のパス>");
	process.exit(1);
}

const zip = buildDemoZip();
writeFileSync(output, zip);
console.log(`${output} に書き出しました（${zip.length} バイト）`);
