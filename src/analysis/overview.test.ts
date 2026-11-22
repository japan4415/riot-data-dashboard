import { describe, expect, it } from "vitest";
import { buildActivityIndex } from "./activity.ts";
import { fixedOffset } from "./localTime.ts";
import {
	groupSummaries,
	overviewStats,
	recordSpan,
	recordYears,
} from "./overview.ts";
import { ALL_PERIOD } from "./period.ts";
import { at, datasetOf, login, match, payment } from "./testing.ts";

const jst = fixedOffset(540);

const dataset = datasetOf({
	logins: [
		login("2023-05-01T03:00:00Z", "lol-tft-pc"),
		login("2023-05-02T03:00:00Z", "lol-tft-pc"),
		login("2024-02-01T03:00:00Z", "valorant"),
	],
	matches: [
		match("2024-02-01T04:00:00Z", { minutes: 40, outcome: "win" }),
		match("2024-02-01T05:00:00Z", { minutes: 30, outcome: "loss" }),
		match("2024-02-02T05:00:00Z", { minutes: 20, outcome: "win" }),
		// 練習は試合数と勝率に数えないが、時間には含める
		match("2024-02-02T06:00:00Z", {
			minutes: 10,
			category: "practice",
			outcome: "none",
		}),
		// 勝敗の記録が当てにならない種別
		match("2024-02-03T06:00:00Z", {
			minutes: 5,
			category: "other",
			outcome: "loss",
			countsForWinRate: false,
		}),
		match("2023-06-01T05:00:00Z", {
			game: "lor",
			minutes: 10,
			outcome: "win",
		}),
	],
	payments: [
		payment("2024-02-01T00:00:00Z", "JPY", 120000),
		payment("2024-03-01T00:00:00Z", "JPY", 50000),
		payment("2013-03-01T00:00:00Z", "USD", 1200, "lol"),
	],
});
const index = buildActivityIndex(dataset, jst);

describe("recordSpan / recordYears", () => {
	it("すべての種類のデータから、最古と最新の時刻を求める", () => {
		expect(recordSpan(dataset)).toEqual({
			first: at("2013-03-01T00:00:00Z"),
			last: at("2024-03-01T00:00:00Z"),
		});
	});

	it("記録が無ければ null", () => {
		expect(recordSpan(datasetOf({}))).toBeNull();
		expect(recordYears(datasetOf({}), jst)).toEqual([]);
	});

	it("最初の年から最後の年までを返す", () => {
		const years = recordYears(dataset, jst);

		expect(years[0]).toBe(2013);
		expect(years.at(-1)).toBe(2024);
		expect(years).toHaveLength(12);
	});
});

describe("overviewStats", () => {
	it("全期間の数値をまとめる", () => {
		expect(overviewStats(dataset, index, ALL_PERIOD, jst)).toEqual({
			activeDays: 6,
			matches: 5,
			playSeconds: (40 + 30 + 20 + 10 + 5 + 10) * 60,
			hasMatches: true,
			spending: [
				{ currency: "JPY", amountX100: 170000 },
				{ currency: "USD", amountX100: 1200 },
			],
		});
	});

	it("期間を絞ると、その年の分だけを数える", () => {
		expect(
			overviewStats(dataset, index, { kind: "year", year: 2023 }, jst),
		).toEqual({
			activeDays: 3,
			matches: 1,
			playSeconds: 600,
			hasMatches: true,
			spending: [],
		});
	});

	it("試合履歴が無いデータでは、その旨を返す", () => {
		const loginsOnly = datasetOf({
			logins: [login("2023-05-01T03:00:00Z", "lol-tft-pc")],
		});

		expect(
			overviewStats(
				loginsOnly,
				buildActivityIndex(loginsOnly, jst),
				ALL_PERIOD,
				jst,
			),
		).toMatchObject({ activeDays: 1, matches: 0, hasMatches: false });
	});

	it("時刻が分からない試合は、全期間のときだけ数える", () => {
		const withUnknown = datasetOf({
			matches: [match(null, { game: "wildrift", minutes: 15 })],
		});
		const unknownIndex = buildActivityIndex(withUnknown, jst);

		expect(
			overviewStats(withUnknown, unknownIndex, ALL_PERIOD, jst).matches,
		).toBe(1);
		expect(
			overviewStats(
				withUnknown,
				unknownIndex,
				{ kind: "year", year: 2024 },
				jst,
			).matches,
		).toBe(0);
	});
});

describe("groupSummaries", () => {
	it("区分ごとの活動日数と、試合の成績をまとめる", () => {
		const summaries = groupSummaries(dataset, index, ALL_PERIOD, jst);

		expect(summaries.map((summary) => summary.group)).toEqual([
			"lol-tft-pc",
			"valorant",
			"lor",
		]);
		expect(summaries[1]).toEqual({
			group: "valorant",
			activeDays: 3,
			firstDay: 20240201,
			lastDay: 20240203,
			record: {
				matches: 4,
				wins: 2,
				losses: 1,
				winRate: 2 / 3,
				playSeconds: (40 + 30 + 20 + 10 + 5) * 60,
			},
		});
	});

	it("試合履歴が無い区分は、成績を null にする", () => {
		const summaries = groupSummaries(dataset, index, ALL_PERIOD, jst);

		expect(summaries[0]).toEqual({
			group: "lol-tft-pc",
			activeDays: 2,
			firstDay: 20230501,
			lastDay: 20230502,
			record: null,
		});
	});

	it("期間内に活動が無い区分は含めない", () => {
		const summaries = groupSummaries(
			dataset,
			index,
			{ kind: "year", year: 2023 },
			jst,
		);

		expect(summaries.map((summary) => summary.group)).toEqual([
			"lol-tft-pc",
			"lor",
		]);
	});

	it("勝敗の付いた試合が無ければ、勝率は null", () => {
		const summaries = groupSummaries(
			dataset,
			index,
			{ kind: "year", year: 2023 },
			jst,
		);

		expect(summaries[1]?.record).toMatchObject({
			matches: 1,
			wins: 1,
			losses: 0,
			winRate: 1,
		});

		const practiceOnly = datasetOf({
			matches: [
				match("2024-02-02T06:00:00Z", {
					category: "practice",
					outcome: "none",
				}),
			],
		});
		const practiceSummaries = groupSummaries(
			practiceOnly,
			buildActivityIndex(practiceOnly, jst),
			ALL_PERIOD,
			jst,
		);
		expect(practiceSummaries[0]?.record).toMatchObject({
			matches: 0,
			winRate: null,
		});
	});
});
