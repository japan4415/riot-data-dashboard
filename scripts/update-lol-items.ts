/**
 * League of Legends の品目 ID と名前の対応表を作り直す開発用の道具。
 *
 * Riot Games が公開している静的データ（Data Dragon）から、チャンピオンとスキンの
 * 日本語名を取り出し、`src/labels/data/lolItems.json` に書き出す。
 * アプリケーションは実行時に通信しないので、対応表はリポジトリに同梱する。
 *
 *   node scripts/update-lol-items.ts
 *
 * 新しいチャンピオンやスキンが加わったら、実行し直して結果をコミットする。
 */
import { writeFileSync } from "node:fs";

const BASE_URL = "https://ddragon.leagueoflegends.com";
const LOCALE = "ja_JP";
const OUTPUT = new URL("../src/labels/data/lolItems.json", import.meta.url);

/** 取得したデータは外部の入力として扱い、形を確かめてから使う。 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function fetchJson(url: string): Promise<unknown> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`${url} の取得に失敗しました（${response.status}）`);
	}
	return response.json();
}

/** 名前に混じる HTML のタグと、制御文字を取り除く。 */
function cleanName(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}
	const name = value
		.replace(/<[^>]*>/g, "")
		// biome-ignore lint/suspicious/noControlCharactersInRegex: 制御文字を取り除くための指定
		.replace(/[\u0000-\u001f\u007f]/g, "")
		.trim();
	return name === "" ? null : name;
}

const versions = await fetchJson(`${BASE_URL}/api/versions.json`);
const version = Array.isArray(versions) ? versions[0] : null;
if (typeof version !== "string" || !/^\d+(\.\d+)+$/.test(version)) {
	throw new Error("最新のバージョンを読み取れませんでした");
}

const full = await fetchJson(
	`${BASE_URL}/cdn/${version}/data/${LOCALE}/championFull.json`,
);
const data = isRecord(full) && isRecord(full.data) ? full.data : null;
if (!data) {
	throw new Error("チャンピオンのデータを読み取れませんでした");
}

const champions = new Map<number, string>();
const skins = new Map<number, string>();
for (const champion of Object.values(data)) {
	if (!isRecord(champion)) {
		continue;
	}
	// `key` はチャンピオンの数値 ID。ストアの品目 ID（`champions_<数値>`）と対応する
	const key = Number(champion.key);
	const name = cleanName(champion.name);
	if (!Number.isSafeInteger(key) || key <= 0 || name === null) {
		continue;
	}
	champions.set(key, name);

	for (const skin of Array.isArray(champion.skins) ? champion.skins : []) {
		if (!isRecord(skin)) {
			continue;
		}
		// スキンの ID は「チャンピオンの ID × 1000 + スキンの番号」。番号 0 は通常の見た目
		const id = Number(skin.id);
		const skinName = cleanName(skin.name);
		if (
			!Number.isSafeInteger(id) ||
			Math.floor(id / 1000) !== key ||
			id % 1000 === 0 ||
			skinName === null
		) {
			continue;
		}
		skins.set(id, skinName);
	}
}

if (champions.size < 100 || skins.size < 1000) {
	throw new Error(
		`取り出せた件数が少なすぎます（チャンピオン ${champions.size}、スキン ${skins.size}）`,
	);
}

/** ID の小さい順に並べ、差分を読みやすくする。 */
function sorted(map: Map<number, string>): Record<string, string> {
	return Object.fromEntries(
		[...map].sort(([a], [b]) => a - b).map(([id, name]) => [String(id), name]),
	);
}

const output = {
	source: "Riot Games Data Dragon",
	version,
	locale: LOCALE,
	champions: sorted(champions),
	skins: sorted(skins),
};
writeFileSync(OUTPUT, `${JSON.stringify(output, null, "\t")}\n`);
console.log(
	`バージョン ${version}: チャンピオン ${champions.size} 件、スキン ${skins.size} 件を書き出しました`,
);
