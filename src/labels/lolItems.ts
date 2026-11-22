import data from "./data/lolItems.json";

/**
 * League of Legends の品目 ID を、名前に直す。
 *
 * 対応表は、Riot Games が公開している静的データ（Data Dragon）から
 * `scripts/update-lol-items.ts` で作ったもので、チャンピオンとスキンだけを持つ。
 * 対応表は大きいので、このファイルは LoL の画面からだけ読み込むこと
 * （ほかの画面から読み込むと、最初に読み込むコードが大きくなる）。
 */
const CHAMPIONS: Readonly<Record<string, string>> = data.champions;
const SKINS: Readonly<Record<string, string>> = data.skins;

/** 対応表を作ったときの、ゲームデータのバージョン。 */
export const LOL_ITEM_DATA_VERSION: string = data.version;

const CHAMPION_ID = /^champions_(\d+)$/;
const SKIN_ID = /^championsskin_(\d+)$/;

function lookup(table: Readonly<Record<string, string>>, key: string) {
	return Object.hasOwn(table, key) ? (table[key] ?? null) : null;
}

/**
 * 品目 ID に対応する名前。チャンピオン（`champions_<数値>`）とスキン
 * （`championsskin_<数値>`）だけが分かる。分からなければ null。
 *
 * 対応表より新しいチャンピオンやスキンも、分からないものとして null を返す。
 */
export function lolItemName(rawId: string | null): string | null {
	if (rawId === null) {
		return null;
	}
	const champion = CHAMPION_ID.exec(rawId);
	if (champion?.[1] !== undefined) {
		// 先頭に 0 が付いた表記でも引けるよう、数値に直してから文字列に戻す
		return lookup(CHAMPIONS, String(Number(champion[1])));
	}
	const skin = SKIN_ID.exec(rawId);
	if (skin?.[1] !== undefined) {
		return lookup(SKINS, String(Number(skin[1])));
	}
	return null;
}
