import { describe, expect, it } from "vitest";
import {
	factionCombos,
	medianTurns,
	outcomeReasons,
	turnHistogram,
} from "./lor.ts";
import { lorMatch } from "./testing.ts";

const matches = [
	lorMatch("2021-01-01T00:00:00Z", {
		factions: ["Ionia", "Demacia"],
		turnCount: 12,
		outcomeReason: "Concession",
	}),
	lorMatch(
		"2021-01-02T00:00:00Z",
		{
			factions: ["Demacia", "Ionia"],
			turnCount: 4,
			outcomeReason: "Zero Health",
		},
		{ outcome: "loss" },
	),
	lorMatch("2021-01-03T00:00:00Z", {
		factions: ["Noxus"],
		turnCount: 21,
		outcomeReason: "Concession",
	}),
	lorMatch("2021-01-04T00:00:00Z", { factions: [], turnCount: null }),
	// 練習は、どの集計にも含めない
	lorMatch(
		"2021-01-05T00:00:00Z",
		{ factions: ["Noxus"], turnCount: 99, outcomeReason: "Zero Health" },
		{ category: "practice" },
	),
];

describe("factionCombos", () => {
	it("地域の並びが違うだけの組み合わせを、同じものとして数える", () => {
		const [first] = factionCombos(matches);
		expect(first).toEqual({
			key: "Demacia+Ionia",
			factions: ["Demacia", "Ionia"],
			matches: 2,
			wins: 1,
			losses: 1,
			winRate: 0.5,
		});
	});

	it("試合が多い順に並べ、地域の記録が無い試合もまとめる", () => {
		expect(factionCombos(matches).map((combo) => combo.key)).toEqual([
			"Demacia+Ionia",
			"",
			"Noxus",
		]);
	});

	it("練習の試合は含めない", () => {
		const noxus = factionCombos(matches).find((combo) => combo.key === "Noxus");
		expect(noxus?.matches).toBe(1);
	});
});

describe("turnHistogram", () => {
	it("5 ターンごとに区切り、試合が無い区切りも含める", () => {
		expect(turnHistogram(matches)).toEqual([
			{ from: 0, to: 4, wins: 0, losses: 1, others: 0 },
			{ from: 5, to: 9, wins: 0, losses: 0, others: 0 },
			{ from: 10, to: 14, wins: 1, losses: 0, others: 0 },
			{ from: 15, to: 19, wins: 0, losses: 0, others: 0 },
			{ from: 20, to: 24, wins: 1, losses: 0, others: 0 },
		]);
	});

	it("勝敗が付いていない試合は、別に数える", () => {
		const bins = turnHistogram([
			lorMatch("2021-01-01T00:00:00Z", { turnCount: 3 }, { outcome: "none" }),
		]);
		expect(bins).toEqual([{ from: 0, to: 4, wins: 0, losses: 0, others: 1 }]);
	});

	it("区切りが増えすぎるときは、最後の区切りにまとめる", () => {
		const bins = turnHistogram([
			lorMatch("2021-01-01T00:00:00Z", { turnCount: 2 }),
			lorMatch("2021-01-02T00:00:00Z", { turnCount: 500 }),
		]);
		expect(bins).toHaveLength(16);
		expect(bins.at(-1)).toEqual({
			from: 75,
			to: null,
			wins: 1,
			losses: 0,
			others: 0,
		});
	});

	it("ターン数の記録が無ければ空", () => {
		expect(turnHistogram([lorMatch("2021-01-01T00:00:00Z")])).toEqual([]);
	});
});

describe("medianTurns", () => {
	it("練習を除いた試合の中央値を返す", () => {
		expect(medianTurns(matches)).toBe(12);
	});

	it("記録が無ければ null", () => {
		expect(medianTurns([])).toBeNull();
	});
});

describe("outcomeReasons", () => {
	it("決着の理由ごとに、試合数と勝敗を数える", () => {
		expect(outcomeReasons(matches)).toEqual([
			{ reason: "Concession", matches: 2, wins: 2, losses: 0, winRate: 1 },
			{ reason: null, matches: 1, wins: 1, losses: 0, winRate: 1 },
			{ reason: "Zero Health", matches: 1, wins: 0, losses: 1, winRate: 0 },
		]);
	});
});
