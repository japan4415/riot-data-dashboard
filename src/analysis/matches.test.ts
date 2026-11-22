import { describe, expect, it } from "vitest";
import { fixedOffset } from "./localTime.ts";
import {
	matchBuckets,
	matchesOf,
	matchSummary,
	queueRecords,
	winLoss,
} from "./matches.ts";
import { ALL_PERIOD } from "./period.ts";
import { datasetOf, match } from "./testing.ts";

const jst = fixedOffset(540);

const valorant = [
	match("2024-02-01T04:00:00Z", { minutes: 40, rawType: "Ranked" }),
	match("2024-02-01T05:00:00Z", {
		minutes: 30,
		outcome: "loss",
		rawType: "Ranked",
	}),
	match("2023-03-02T05:00:00Z", {
		minutes: 20,
		category: "normal",
		rawType: "Unrated",
	}),
	// 練習は試合数と勝率に数えないが、時間には含める
	match("2024-02-02T06:00:00Z", {
		minutes: 10,
		category: "practice",
		outcome: "none",
		rawMode: "ShootingRange",
	}),
	// 勝敗の記録が当てにならない種別
	match("2024-05-03T06:00:00Z", {
		minutes: 5,
		category: "other",
		outcome: "loss",
		countsForWinRate: false,
		rawType: "Deathmatch",
	}),
];
const dataset = datasetOf({
	matches: [
		...valorant,
		match("2022-06-01T05:00:00Z", { game: "lor" }),
		match(null, { game: "wildrift" }),
	],
});

describe("matchesOf", () => {
	it("指定したゲームの試合だけを、古い順に返す", () => {
		const result = matchesOf(dataset, "valorant", ALL_PERIOD, jst);
		expect(result).toHaveLength(5);
		expect(
			result.map((item) => item.queue.rawType ?? item.queue.rawMode),
		).toEqual(["Unrated", "Ranked", "Ranked", "ShootingRange", "Deathmatch"]);
	});

	it("年で絞り込む", () => {
		expect(
			matchesOf(dataset, "valorant", { kind: "year", year: 2023 }, jst),
		).toHaveLength(1);
		expect(
			matchesOf(dataset, "valorant", { kind: "year", year: 1999 }, jst),
		).toEqual([]);
	});

	it("時刻が分からない試合は、全期間のときだけ含める", () => {
		expect(matchesOf(dataset, "wildrift", ALL_PERIOD, jst)).toHaveLength(1);
		expect(
			matchesOf(dataset, "wildrift", { kind: "year", year: 2024 }, jst),
		).toEqual([]);
	});
});

describe("winLoss / matchSummary", () => {
	it("勝率に数える試合だけから勝敗を数える", () => {
		expect(winLoss(valorant)).toEqual({ wins: 2, losses: 1, winRate: 2 / 3 });
	});

	it("勝敗の付いた試合が無ければ、勝率は null", () => {
		expect(winLoss([])).toEqual({ wins: 0, losses: 0, winRate: null });
	});

	it("練習は試合数から除き、時間には含める", () => {
		expect(matchSummary(valorant)).toEqual({
			wins: 2,
			losses: 1,
			winRate: 2 / 3,
			matches: 4,
			practice: 1,
			playSeconds: (40 + 30 + 20 + 10 + 5) * 60,
			// 練習を除いた 5, 20, 30, 40 分の中央値。件数が偶数なので、中央の 2 つの平均
			medianSeconds: 25 * 60,
		});
	});

	it("試合が無ければ、長さの中央値は null", () => {
		expect(matchSummary([]).medianSeconds).toBeNull();
	});
});

describe("queueRecords", () => {
	it("種別ごとにまとめ、区分の順に並べる", () => {
		const records = queueRecords(valorant);
		expect(
			records.map((record) => [record.category, record.name, record.matches]),
		).toEqual([
			["ranked", "Ranked", 2],
			["normal", "Unrated", 1],
			["other", "Deathmatch", 1],
			["practice", "ShootingRange", 1],
		]);
	});

	it("種別ごとの勝敗と時間を数える", () => {
		const [ranked] = queueRecords(valorant);
		expect(ranked).toMatchObject({
			wins: 1,
			losses: 1,
			winRate: 0.5,
			counted: true,
			playSeconds: 70 * 60,
		});
	});

	it("勝率に数えない種別は、勝敗を数えない", () => {
		const deathmatch = queueRecords(valorant).find(
			(record) => record.name === "Deathmatch",
		);
		expect(deathmatch).toMatchObject({
			wins: 0,
			losses: 0,
			winRate: null,
			counted: false,
		});
	});

	it("同じ区分の中では、多い順に並べる", () => {
		const records = queueRecords([
			match("2024-01-01T00:00:00Z", { category: "other", rawType: "A" }),
			match("2024-01-02T00:00:00Z", { category: "other", rawType: "B" }),
			match("2024-01-03T00:00:00Z", { category: "other", rawType: "B" }),
		]);
		expect(records.map((record) => record.name)).toEqual(["B", "A"]);
	});

	it("名前の無い種別も 1 つにまとめる", () => {
		const records = queueRecords([
			match("2024-01-01T00:00:00Z", { category: "other" }),
			match("2024-01-02T00:00:00Z", { category: "other" }),
		]);
		expect(records).toHaveLength(1);
		expect(records[0]?.name).toBeNull();
	});
});

describe("matchBuckets", () => {
	it("全期間では、最初の試合の年から最後の年までを年ごとに区切る", () => {
		const { buckets, undated } = matchBuckets(valorant, ALL_PERIOD, jst);
		expect(buckets.map((bucket) => bucket.key)).toEqual([2023, 2024]);
		expect(buckets[0]?.counts).toMatchObject({ normal: 1, ranked: 0 });
		expect(buckets[1]?.counts).toEqual({
			ranked: 2,
			normal: 0,
			other: 1,
			custom: 0,
			practice: 1,
		});
		expect(undated).toBe(0);
	});

	it("試合が無い年も区切りに含める", () => {
		const { buckets } = matchBuckets(
			[match("2020-01-01T00:00:00Z"), match("2023-01-01T00:00:00Z")],
			ALL_PERIOD,
			jst,
		);
		expect(buckets.map((bucket) => bucket.key)).toEqual([
			2020, 2021, 2022, 2023,
		]);
		expect(buckets[1]?.counts.ranked).toBe(0);
	});

	it("1 年分では、月ごとに区切る", () => {
		const period = { kind: "year", year: 2024 } as const;
		const { buckets } = matchBuckets(
			matchesOf(dataset, "valorant", period, jst),
			period,
			jst,
		);
		expect(buckets).toHaveLength(12);
		expect(buckets[1]?.counts).toMatchObject({ ranked: 2, practice: 1 });
		expect(buckets[4]?.counts.other).toBe(1);
	});

	it("月の境目は、利用者の時刻で決める", () => {
		// UTC では 1 月 31 日 16 時、日本時間では 2 月 1 日 1 時
		const { buckets } = matchBuckets(
			[match("2024-01-31T16:00:00Z")],
			{ kind: "year", year: 2024 },
			jst,
		);
		expect(buckets[0]?.counts.ranked).toBe(0);
		expect(buckets[1]?.counts.ranked).toBe(1);
	});

	it("時刻が分からない試合は、区切りに入れずに数だけ返す", () => {
		const { buckets, undated } = matchBuckets(
			[match(null), match("2024-01-01T00:00:00Z")],
			ALL_PERIOD,
			jst,
		);
		expect(buckets).toHaveLength(1);
		expect(undated).toBe(1);
	});

	it("試合が無ければ、全期間の区切りは空", () => {
		expect(matchBuckets([], ALL_PERIOD, jst)).toEqual({
			buckets: [],
			undated: 0,
		});
	});
});
