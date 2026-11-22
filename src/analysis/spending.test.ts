import { describe, expect, it } from "vitest";
import { fixedOffset } from "./localTime.ts";
import { ALL_PERIOD } from "./period.ts";
import {
	cumulativeSpending,
	paymentsInPeriod,
	paymentsOf,
	spendingBuckets,
	spendingByGame,
	spendingTotals,
} from "./spending.ts";
import { at, datasetOf, payment } from "./testing.ts";

const jst = fixedOffset(540);

const dataset = datasetOf({
	payments: [
		payment("2024-03-01T00:00:00Z", "JPY", 500000, "valorant"),
		payment("2013-03-01T00:00:00Z", "USD", 1200, "lol"),
		payment("2021-02-01T00:00:00Z", "JPY", 130000, "lol"),
		payment("2024-02-01T00:00:00Z", "JPY", 120000, "valorant"),
		payment("2020-02-01T00:00:00Z", "JPY", 60000, "lor"),
	],
});
const payments = paymentsOf(dataset);

describe("paymentsOf / paymentsInPeriod", () => {
	it("支払いを古い順に並べる", () => {
		expect(payments.map((item) => item.at)).toEqual([
			at("2013-03-01T00:00:00Z"),
			at("2020-02-01T00:00:00Z"),
			at("2021-02-01T00:00:00Z"),
			at("2024-02-01T00:00:00Z"),
			at("2024-03-01T00:00:00Z"),
		]);
	});

	it("年で絞り込む。年の境目は利用者の時刻で決める", () => {
		expect(
			paymentsInPeriod(payments, { kind: "year", year: 2024 }, jst),
		).toHaveLength(2);
		// UTC では 2023 年の大みそか 16 時、日本時間では 2024 年の元日 1 時
		const boundary = [payment("2023-12-31T16:00:00Z", "JPY", 100)];
		expect(
			paymentsInPeriod(boundary, { kind: "year", year: 2024 }, jst),
		).toHaveLength(1);
		expect(paymentsInPeriod(payments, ALL_PERIOD, jst)).toHaveLength(5);
	});
});

describe("spendingTotals / spendingByGame", () => {
	it("通貨ごとに合計し、換算しない", () => {
		expect(spendingTotals(payments)).toEqual([
			{ currency: "JPY", amountX100: 810000, count: 4 },
			{ currency: "USD", amountX100: 1200, count: 1 },
		]);
	});

	it("支払いが無ければ空", () => {
		expect(spendingTotals([])).toEqual([]);
	});

	it("ゲームと通貨の組ごとに合計し、決まった順に並べる", () => {
		expect(spendingByGame(payments, ["lol", "valorant", "lor"])).toEqual([
			{ game: "lol", currency: "JPY", amountX100: 130000, count: 1 },
			{ game: "lol", currency: "USD", amountX100: 1200, count: 1 },
			{ game: "valorant", currency: "JPY", amountX100: 620000, count: 2 },
			{ game: "lor", currency: "JPY", amountX100: 60000, count: 1 },
		]);
	});
});

describe("spendingBuckets", () => {
	it("全期間では、その通貨の最初の年から最後の年までを年ごとに区切る", () => {
		const buckets = spendingBuckets(payments, "JPY", ALL_PERIOD, jst);
		expect(buckets.map((bucket) => bucket.key)).toEqual([
			2020, 2021, 2022, 2023, 2024,
		]);
		expect(buckets[0]?.amounts).toEqual({ lor: 60000 });
		expect(buckets[2]?.amounts).toEqual({});
		expect(buckets[4]?.amounts).toEqual({ valorant: 620000 });
	});

	it("ほかの通貨の支払いは含めない", () => {
		expect(spendingBuckets(payments, "USD", ALL_PERIOD, jst)).toEqual([
			{ key: 2013, amounts: { lol: 1200 } },
		]);
	});

	it("1 年分では、月ごとに区切る", () => {
		const period = { kind: "year", year: 2024 } as const;
		const buckets = spendingBuckets(
			paymentsInPeriod(payments, period, jst),
			"JPY",
			period,
			jst,
		);
		expect(buckets).toHaveLength(12);
		expect(buckets[1]?.amounts).toEqual({ valorant: 120000 });
		expect(buckets[2]?.amounts).toEqual({ valorant: 500000 });
	});

	it("その通貨の支払いが無ければ、全期間の区切りは空", () => {
		expect(spendingBuckets(payments, "EUR", ALL_PERIOD, jst)).toEqual([]);
	});
});

describe("cumulativeSpending", () => {
	it("支払いごとに、記録の最初からの累計を返す", () => {
		expect(cumulativeSpending(payments, "JPY", ALL_PERIOD, jst)).toEqual({
			points: [
				{ at: at("2020-02-01T00:00:00Z"), amountX100: 60000 },
				{ at: at("2021-02-01T00:00:00Z"), amountX100: 190000 },
				{ at: at("2024-02-01T00:00:00Z"), amountX100: 310000 },
				{ at: at("2024-03-01T00:00:00Z"), amountX100: 810000 },
			],
			opening: 0,
		});
	});

	it("1 年分では、その年が始まる前までの累計から始める", () => {
		expect(
			cumulativeSpending(payments, "JPY", { kind: "year", year: 2024 }, jst),
		).toEqual({
			points: [
				{ at: at("2024-02-01T00:00:00Z"), amountX100: 310000 },
				{ at: at("2024-03-01T00:00:00Z"), amountX100: 810000 },
			],
			opening: 190000,
		});
	});

	it("その年に支払いが無くても、それまでの累計は返す", () => {
		expect(
			cumulativeSpending(payments, "JPY", { kind: "year", year: 2022 }, jst),
		).toEqual({ points: [], opening: 190000 });
	});

	it("同じ時刻の支払いは、1 点にまとめる", () => {
		const { points } = cumulativeSpending(
			[
				payment("2024-01-01T00:00:00Z", "JPY", 100),
				payment("2024-01-01T00:00:00Z", "JPY", 200),
			],
			"JPY",
			ALL_PERIOD,
			jst,
		);
		expect(points).toEqual([
			{ at: at("2024-01-01T00:00:00Z"), amountX100: 300 },
		]);
	});
});
