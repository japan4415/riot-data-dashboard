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

	it("先頭に 0 が付いた ID も、同じ品目として引ける", () => {
		expect(lolItemName("champions_001")).toBe("アニー");
		expect(lolItemName("championsskin_01001")).toBe("ゴス アニー");
	});

	it("桁が多すぎる ID は null", () => {
		expect(lolItemName(`champions_${"9".repeat(40)}`)).toBeNull();
		expect(lolItemName(`championsskin_${"9".repeat(40)}`)).toBeNull();
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

	it("名前に HTML のタグや、見えない文字を含まない", () => {
		const names = [
			...Object.values(data.champions),
			...Object.values(data.skins),
		];
		expect(names.length).toBeGreaterThan(1000);
		// 制御文字、文字の並ぶ向きを変える文字、幅の無い文字、行の区切り
		const unsafe = names.filter((name) =>
			/[<>\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(name),
		);
		expect(unsafe).toEqual([]);
	});

	it("名前は空でなく、長すぎず、前後に空白が無い", () => {
		const names = [
			...Object.values(data.champions),
			...Object.values(data.skins),
		];
		const odd = names.filter(
			(name) => name.length === 0 || name.length > 100 || name !== name.trim(),
		);
		expect(odd).toEqual([]);
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
