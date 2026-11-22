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
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

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

/** 名前として受け付ける長さの上限。これまでの最長は 52 文字。 */
const MAX_NAME_LENGTH = 100;
/** これより長い値は、名前ではないとみなして読まない。 */
const MAX_RAW_LENGTH = 1000;

/**
 * 名前に混じる HTML のタグと、見えない文字を取り除く。
 *
 * 見えない文字には、制御文字のほか、文字の並ぶ向きを変える文字や幅の無い文字がある。
 * 表示が崩れたり、別の文字列に見せかけられたりするので、同梱する名前には残さない。
 * 名前として読めない値は null にする。
 */
function cleanName(value: unknown): string | null {
	if (typeof value !== "string" || value.length > MAX_RAW_LENGTH) {
		return null;
	}
	const name = value
		.replace(/<[^<>]*>/g, "")
		.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, "")
		.trim();
	return name === "" || name.length > MAX_NAME_LENGTH || /[<>]/.test(name)
		? null
		: name;
}

/**
 * ID を読む。10 進の数字だけの文字列か、正の整数だけを受け付ける。
 * `Number()` は `"0x10"` や `true` も数に直してしまうので、形を先に確かめる。
 */
function readId(value: unknown, maxDigits: number): number | null {
	const text =
		typeof value === "number" && Number.isSafeInteger(value)
			? String(value)
			: value;
	if (typeof text !== "string" || !/^[1-9]\d*$/.test(text)) {
		return null;
	}
	return text.length <= maxDigits ? Number(text) : null;
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
/** 形が想定と違っていて、読まなかった項目の数。 */
let skipped = 0;

/** 同じ ID が 2 度現れたら、データの形が想定と違うので中止する。 */
function addOnce(map: Map<number, string>, id: number, name: string) {
	if (map.has(id)) {
		throw new Error(`ID ${id} が重複しています`);
	}
	map.set(id, name);
}

for (const champion of Object.values(data)) {
	// `key` はチャンピオンの数値 ID。ストアの品目 ID（`champions_<数値>`）と対応する
	const key = isRecord(champion) ? readId(champion.key, 6) : null;
	const name = isRecord(champion) ? cleanName(champion.name) : null;
	if (!isRecord(champion) || key === null || name === null) {
		skipped += 1;
		continue;
	}
	addOnce(champions, key, name);

	for (const skin of Array.isArray(champion.skins) ? champion.skins : []) {
		// スキンの ID は「チャンピオンの ID × 1000 + スキンの番号」。番号 0 は通常の見た目
		const id = isRecord(skin) ? readId(skin.id, 9) : null;
		if (id !== null && Math.floor(id / 1000) === key && id % 1000 === 0) {
			continue;
		}
		const skinName = isRecord(skin) ? cleanName(skin.name) : null;
		if (id === null || Math.floor(id / 1000) !== key || skinName === null) {
			skipped += 1;
			continue;
		}
		addOnce(skins, id, skinName);
	}
}

if (champions.size < 100 || skins.size < 1000) {
	throw new Error(
		`取り出せた件数が少なすぎます（チャンピオン ${champions.size}、スキン ${skins.size}）`,
	);
}

/**
 * いまの対応表と比べて件数が大きく減っていたら、取得したデータが欠けているとみなして中止する。
 * 意図して減らすときは `--force` を付ける。
 */
function previousCounts(): { champions: number; skins: number } | null {
	if (!existsSync(OUTPUT)) {
		return null;
	}
	try {
		const previous: unknown = JSON.parse(readFileSync(OUTPUT, "utf8"));
		if (
			isRecord(previous) &&
			isRecord(previous.champions) &&
			isRecord(previous.skins)
		) {
			return {
				champions: Object.keys(previous.champions).length,
				skins: Object.keys(previous.skins).length,
			};
		}
	} catch {
		// いまの対応表が読めないときは、比べずに作り直す
	}
	return null;
}

const previous = previousCounts();
if (
	previous &&
	!process.argv.includes("--force") &&
	(champions.size < previous.champions * 0.9 ||
		skins.size < previous.skins * 0.9)
) {
	throw new Error(
		`件数が大きく減っています（チャンピオン ${previous.champions} → ${champions.size}、スキン ${previous.skins} → ${skins.size}）。意図したものなら --force を付けてください`,
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
// 途中で止まっても壊れたファイルを残さないよう、別の名前で書いてから置き換える
const temporary = new URL(`${OUTPUT.href}.tmp`);
writeFileSync(temporary, `${JSON.stringify(output, null, "\t")}\n`);
renameSync(temporary, OUTPUT);
console.log(
	`バージョン ${version}: チャンピオン ${champions.size} 件、スキン ${skins.size} 件を書き出しました（読まなかった項目 ${skipped} 件）`,
);
