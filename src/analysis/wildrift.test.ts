import { describe, expect, it } from "vitest";
import type { InventoryItem } from "../model/types.ts";
import { at, wildriftMatch } from "./testing.ts";
import {
	highestRank,
	inventoryCounts,
	parseRank,
	rankHistory,
} from "./wildrift.ts";

describe("parseRank", () => {
	it("ティアと段階を読む", () => {
		expect(parseRank("Gold III")).toEqual({
			tier: "Gold",
			tierIndex: 3,
			division: 3,
			ordinal: 13,
		});
	});

	it("段階が 1 つ上がると、高さが 1 増える", () => {
		const ordinals = ["Iron IV", "Iron III", "Iron I", "Bronze IV"].map(
			(rank) => parseRank(rank)?.ordinal,
		);
		expect(ordinals).toEqual([0, 1, 3, 4]);
	});

	it("段階の無いティアも読む", () => {
		expect(parseRank("Master")).toMatchObject({
			tier: "Master",
			division: null,
			ordinal: 28,
		});
	});

	it("大文字小文字と前後の空白の違いを吸収する", () => {
		expect(parseRank(" gold  iv ")?.ordinal).toBe(12);
	});

	it("知らないティアや読めない表記は null", () => {
		expect(parseRank(null)).toBeNull();
		expect(parseRank("")).toBeNull();
		expect(parseRank("Mythic I")).toBeNull();
		expect(parseRank("Gold V")).toBeNull();
		expect(parseRank("Gold III extra")).toBeNull();
	});
});

describe("rankHistory", () => {
	const matches = [
		wildriftMatch("2021-03-01T00:00:00Z", "Silver I", { outcome: "loss" }),
		wildriftMatch("2021-01-01T00:00:00Z", "Bronze II"),
		wildriftMatch("2021-02-01T00:00:00Z", "Gold IV"),
		// ランクの記録が無い試合（チュートリアルなど）
		wildriftMatch("2021-01-15T00:00:00Z", null),
		// 時刻が分からない試合
		wildriftMatch(null, "Gold I"),
		// 読めないランク
		wildriftMatch("2021-04-01T00:00:00Z", "Mythic I"),
	];

	it("ランクと時刻がある試合を、古い順に通し番号を付けて並べる", () => {
		const { points } = rankHistory(matches);
		expect(points).toEqual([
			{
				index: 0,
				at: at("2021-01-01T00:00:00Z"),
				rank: "Bronze II",
				ordinal: 6,
				outcome: "win",
			},
			{
				index: 1,
				at: at("2021-02-01T00:00:00Z"),
				rank: "Gold IV",
				ordinal: 12,
				outcome: "win",
			},
			{
				index: 2,
				at: at("2021-03-01T00:00:00Z"),
				rank: "Silver I",
				ordinal: 11,
				outcome: "loss",
			},
		]);
	});

	it("読めなかったランクの数を返す", () => {
		expect(rankHistory(matches).unreadable).toBe(1);
	});

	it("もっとも高いランクを返す。同じ高さなら最初の試合", () => {
		const { points } = rankHistory([
			...matches,
			wildriftMatch("2021-05-01T00:00:00Z", "Gold IV"),
		]);
		expect(highestRank(points)).toMatchObject({ rank: "Gold IV", index: 1 });
		expect(highestRank([])).toBeNull();
	});
});

describe("inventoryCounts", () => {
	const item = (category: InventoryItem["category"]): InventoryItem => ({
		game: "wildrift",
		category,
		name: "Sample",
		detail: null,
		quantity: null,
	});

	it("決まった順に並べ、1 つも無い分類は含めない", () => {
		expect(
			inventoryCounts([item("skin"), item("champion"), item("skin")]),
		).toEqual([
			{ category: "champion", count: 1 },
			{ category: "skin", count: 2 },
		]);
	});
});
