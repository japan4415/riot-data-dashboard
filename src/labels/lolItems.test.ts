import { describe, expect, it } from "vitest";
import data from "./data/lolItems.json";
import { LOL_ITEM_DATA_VERSION, lolItemName } from "./lolItems.ts";

describe("lolItemName", () => {
	it("チャンピオンの ID を名前に直す", () => {
		expect(lolItemName("champions_1")).toBe("アニー");
		expect(lolItemName("champions_103")).toBe("アーリ");
	});

	it("スキンの ID（チャンピオンの ID × 1000 + 番号）を名前に直す", () => {
		expect(lolItemName("championsskin_1001")).toBe("ゴス アニー");
	});

	it("対応表に無い ID は null", () => {
		expect(lolItemName("champions_999999")).toBeNull();
		expect(lolItemName("championsskin_999999999")).toBeNull();
		// スキンの番号 0 は通常の見た目で、品目としては売られていない
		expect(lolItemName("championsskin_1000")).toBeNull();
	});

	it("チャンピオンとスキン以外の品目は null", () => {
		expect(lolItemName("summoner_icon_1")).toBeNull();
		expect(lolItemName("hextech_crafting_1")).toBeNull();
		expect(lolItemName("bundles_sample")).toBeNull();
		expect(lolItemName("1001")).toBeNull();
		expect(lolItemName("")).toBeNull();
		expect(lolItemName(null)).toBeNull();
	});

	it("ID の形が違うものを、名前に直さない", () => {
		expect(lolItemName("champions_1 ")).toBeNull();
		expect(lolItemName("champions_-1")).toBeNull();
		expect(lolItemName("champions_1.5")).toBeNull();
		expect(lolItemName("champions_constructor")).toBeNull();
		expect(lolItemName("xchampions_1")).toBeNull();
	});
});

describe("同梱している対応表", () => {
	it("出どころとバージョンを記録している", () => {
		expect(data.source).toBe("Riot Games Data Dragon");
		expect(data.locale).toBe("ja_JP");
		expect(LOL_ITEM_DATA_VERSION).toMatch(/^\d+(\.\d+)+$/);
	});

	it("名前に HTML のタグや制御文字を含まない", () => {
		const names = [
			...Object.values(data.champions),
			...Object.values(data.skins),
		];
		expect(names.length).toBeGreaterThan(1000);
		// biome-ignore lint/suspicious/noControlCharactersInRegex: 制御文字が無いことを確かめる
		const unsafe = names.filter((name) => /[<>\u0000-\u001f]/.test(name));
		expect(unsafe).toEqual([]);
	});

	it("キーはすべて数値で、スキンはチャンピオンに属している", () => {
		const champions = new Set(Object.keys(data.champions));
		expect([...champions].every((key) => /^[1-9]\d*$/.test(key))).toBe(true);
		const orphans = Object.keys(data.skins).filter(
			(id) =>
				!/^[1-9]\d*$/.test(id) ||
				!champions.has(String(Math.floor(Number(id) / 1000))),
		);
		expect(orphans).toEqual([]);
	});
});
