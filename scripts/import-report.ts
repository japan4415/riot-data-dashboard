/**
 * 開示データの zip を読み込み、読み込み結果の件数だけを表示する開発用の道具。
 *
 * 個人の値（ID、IP アドレス、本文など）は表示しない。
 *
 *   node scripts/import-report.ts <zip のパス>
 */
import { readFileSync } from "node:fs";
import { importArchive } from "../src/import/importArchive.ts";

const zipPath = process.argv[2];
if (!zipPath) {
	console.error("使い方: node scripts/import-report.ts <zip のパス>");
	process.exit(1);
}

const started = performance.now();
const { dataset, report } = importArchive(
	new Uint8Array(readFileSync(zipPath)),
);
const elapsed = Math.round(performance.now() - started);

console.log("状態         件数   飛ばし  失敗  ファイル  種類");
for (const entry of report.entries) {
	console.log(
		[
			entry.status.padEnd(11),
			String(entry.records).padStart(6),
			String(entry.skipped).padStart(7),
			String(entry.failedFiles).padStart(5),
			String(entry.paths.length).padStart(8),
			` ${entry.game ?? "account"}: ${entry.label}`,
		].join(" "),
	);
}

console.log("\n合計:", report.totals);
console.log(
	"データ:",
	Object.fromEntries(
		Object.entries(dataset).map(([key, value]) => [
			key,
			Array.isArray(value)
				? value.length
				: Object.values(value).filter((field) => field !== null).length,
		]),
	),
);
console.log(`読み込み時間: ${elapsed}ms`);
