import { describe, expect, it } from "vitest";
import {
	activeDaysByGroup,
	activityBuckets,
	buildActivityIndex,
	busiestSlot,
	daysInPeriod,
	hourWeekMatrix,
	levelOf,
	levelThresholds,
	longestStreak,
} from "./activity.ts";
import {
	dayKeyFromNumber,
	dayKeyOf,
	dayKeyParts,
	dayNumber,
	fixedOffset,
	weekdayOfDay,
} from "./localTime.ts";
import { ALL_PERIOD } from "./period.ts";
import { at, datasetOf, login, match } from "./testing.ts";

const jst = fixedOffset(540);

describe("暦の計算", () => {
	it("UTC の時刻を、ずれを加えた暦の値に直す", () => {
		// UTC では金曜 15:30、日本時間では土曜 0:30
		expect(jst(at("2024-03-01T15:30:00Z"))).toEqual({
			year: 2024,
			month: 3,
			day: 2,
			weekday: 6,
			hour: 0,
			minute: 30,
		});
	});

	it("日付の整数と年月日を相互に変換する", () => {
		expect(dayKeyOf({ year: 2024, month: 3, day: 2 })).toBe(20240302);
		expect(dayKeyParts(20240302)).toEqual({ year: 2024, month: 3, day: 2 });
	});

	it("月や年をまたいでも、連続した日の通し番号は 1 ずつ増える", () => {
		expect(dayNumber(20240301) - dayNumber(20240229)).toBe(1);
		expect(dayNumber(20250101) - dayNumber(20241231)).toBe(1);
		expect(dayKeyFromNumber(dayNumber(20241231) + 1)).toBe(20250101);
	});

	it("日付の曜日を求める", () => {
		expect(weekdayOfDay(20240302)).toBe(6);
		expect(weekdayOfDay(20240303)).toBe(0);
	});
});

describe("buildActivityIndex", () => {
	it("ログインと試合を、利用者の時刻での日ごとにまとめる", () => {
		const index = buildActivityIndex(
			datasetOf({
				logins: [
					login("2024-03-01T10:00:00Z", "lol-tft-pc"),
					login("2024-03-01T11:00:00Z", "lol-tft-pc"),
					// 日本時間では翌日
					login("2024-03-01T15:30:00Z", "valorant"),
				],
				matches: [match("2024-03-01T12:00:00Z", { game: "valorant" })],
			}),
			jst,
		);

		expect(index.days.get(20240301)).toEqual({
			day: 20240301,
			count: 3,
			counts: {
				"lol-tft-pc": 2,
				valorant: 1,
				"tft-mobile": 0,
				wildrift: 0,
				lor: 0,
			},
			groups: ["lol-tft-pc", "valorant"],
		});
		expect(index.days.get(20240302)?.count).toBe(1);
		expect(index.days.size).toBe(2);
	});

	it("ログアウトなどの記録は、活動した日としては残すが回数に数えない", () => {
		const index = buildActivityIndex(
			datasetOf({
				logins: [
					login("2024-03-05T01:00:00Z", "wildrift", "logout"),
					login("2024-03-05T02:00:00Z", "wildrift", "auth"),
				],
			}),
			jst,
		);

		expect(index.days.get(20240305)).toMatchObject({
			count: 0,
			groups: ["wildrift"],
		});
		expect(
			hourWeekMatrix(index, ALL_PERIOD)
				.flat()
				.every((n) => n === 0),
		).toBe(true);
	});

	it("Riot アカウント共通の記録は、どのゲームの活動にも数えない", () => {
		const index = buildActivityIndex(
			datasetOf({
				logins: [
					login("2024-03-01T10:00:00Z", "riot-account"),
					login("2024-03-01T10:00:00Z", "other"),
				],
			}),
			jst,
		);

		expect(index.days.size).toBe(0);
		expect(index.years).toEqual([]);
		expect(index.first).toBeNull();
	});

	it("時刻が分からない試合は数えない", () => {
		const index = buildActivityIndex(
			datasetOf({ matches: [match(null, { game: "wildrift" })] }),
			jst,
		);

		expect(index.days.size).toBe(0);
	});

	it("最初の年から最後の年までを、活動が無い年も含めて返す", () => {
		const index = buildActivityIndex(
			datasetOf({
				logins: [
					login("2020-06-01T03:00:00Z", "lor"),
					login("2023-06-01T03:00:00Z", "lor"),
				],
			}),
			jst,
		);

		expect(index.years).toEqual([2020, 2021, 2022, 2023]);
		expect(index.first).toBe(at("2020-06-01T03:00:00Z"));
		expect(index.last).toBe(at("2023-06-01T03:00:00Z"));
	});

	it("その日の区分を、決まった順に並べる", () => {
		const index = buildActivityIndex(
			datasetOf({
				logins: [
					login("2024-03-01T03:00:00Z", "lor"),
					login("2024-03-01T04:00:00Z", "valorant"),
					login("2024-03-01T05:00:00Z", "lol-tft-pc"),
				],
			}),
			jst,
		);

		expect(index.days.get(20240301)?.groups).toEqual([
			"lol-tft-pc",
			"valorant",
			"lor",
		]);
	});
});

describe("期間ごとの集計", () => {
	const index = buildActivityIndex(
		datasetOf({
			logins: [
				login("2023-12-30T03:00:00Z", "lol-tft-pc"),
				login("2023-12-31T03:00:00Z", "lol-tft-pc"),
				login("2024-01-01T03:00:00Z", "lol-tft-pc"),
				login("2024-01-01T04:00:00Z", "valorant"),
				login("2024-01-03T03:00:00Z", "valorant"),
				login("2024-03-10T12:00:00Z", "valorant"),
			],
			matches: [
				// 日本時間で日曜の 21 時台
				match("2024-03-10T12:30:00Z", { game: "valorant" }),
			],
		}),
		jst,
	);

	it("期間に含まれる活動日を、日付の順に返す", () => {
		expect(daysInPeriod(index, ALL_PERIOD).map((day) => day.day)).toEqual([
			20231230, 20231231, 20240101, 20240103, 20240310,
		]);
		expect(
			daysInPeriod(index, { kind: "year", year: 2024 }).map((day) => day.day),
		).toEqual([20240101, 20240103, 20240310]);
	});

	it("区分ごとの活動日数を数える", () => {
		expect(activeDaysByGroup(daysInPeriod(index, ALL_PERIOD))).toMatchObject({
			"lol-tft-pc": 3,
			valorant: 3,
			lor: 0,
		});
	});

	it("年をまたぐ連続日数を数える", () => {
		expect(longestStreak(daysInPeriod(index, ALL_PERIOD))).toEqual({
			length: 3,
			start: 20231230,
			end: 20240101,
		});
	});

	it("期間を絞ると、連続日数もその期間の中で数える", () => {
		expect(
			longestStreak(daysInPeriod(index, { kind: "year", year: 2024 })),
		).toEqual({ length: 1, start: 20240101, end: 20240101 });
	});

	it("活動日が無ければ、連続日数は null", () => {
		expect(longestStreak([])).toBeNull();
	});

	it("全期間では年ごとに、区分別の活動日数をまとめる", () => {
		expect(activityBuckets(index, ALL_PERIOD)).toEqual([
			{
				key: 2023,
				activeDays: {
					"lol-tft-pc": 2,
					valorant: 0,
					"tft-mobile": 0,
					wildrift: 0,
					lor: 0,
				},
			},
			{
				key: 2024,
				activeDays: {
					"lol-tft-pc": 1,
					valorant: 3,
					"tft-mobile": 0,
					wildrift: 0,
					lor: 0,
				},
			},
		]);
	});

	it("1 年分では月ごとにまとめ、活動が無い月も含める", () => {
		const buckets = activityBuckets(index, { kind: "year", year: 2024 });

		expect(buckets.map((bucket) => bucket.key)).toEqual([
			1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
		]);
		expect(buckets[0]?.activeDays).toMatchObject({
			"lol-tft-pc": 1,
			valorant: 2,
		});
		expect(buckets[1]?.activeDays.valorant).toBe(0);
		expect(buckets[2]?.activeDays.valorant).toBe(1);
	});

	it("曜日と時刻ごとの回数を、利用者の時刻で数える", () => {
		const matrix = hourWeekMatrix(index, { kind: "year", year: 2024 });

		// 2024-03-10 は日曜。ログインと試合がどちらも 21 時台
		expect(matrix[0]?.[21]).toBe(2);
		expect(matrix.flat().reduce((sum, n) => sum + n, 0)).toBe(5);
		expect(
			hourWeekMatrix(index, ALL_PERIOD)
				.flat()
				.reduce((sum, n) => sum + n, 0),
		).toBe(7);
	});

	it("もっとも回数が多い曜日と時刻を返す", () => {
		expect(busiestSlot(hourWeekMatrix(index, ALL_PERIOD))).toEqual({
			weekday: 0,
			hour: 21,
			count: 2,
		});
		expect(
			busiestSlot(hourWeekMatrix(index, { kind: "year", year: 1999 })),
		).toBeNull();
	});
});

describe("濃淡の段階", () => {
	it("分布を等しい割合で区切って境界を決める", () => {
		const values = Array.from({ length: 100 }, (_, i) => i + 1);

		expect(levelThresholds(values)).toEqual([26, 51, 76]);
	});

	it("0 以下の値は、境界の計算に使わない", () => {
		expect(levelThresholds([0, 0, 4, 8])).toEqual(levelThresholds([4, 8]));
		expect(levelThresholds([0, 0])).toEqual([]);
	});

	it("値を段階に直す", () => {
		const thresholds = [26, 51, 76];

		expect(levelOf(0, thresholds)).toBe(0);
		expect(levelOf(1, thresholds)).toBe(1);
		expect(levelOf(26, thresholds)).toBe(1);
		expect(levelOf(27, thresholds)).toBe(2);
		expect(levelOf(60, thresholds)).toBe(3);
		expect(levelOf(100, thresholds)).toBe(4);
	});

	it("同じ値の日が多くても、もっとも小さい値は段階 1 になる", () => {
		const thresholds = levelThresholds([1, 1, 1, 1, 1, 1, 2, 5]);

		expect(levelOf(1, thresholds)).toBe(1);
		expect(levelOf(2, thresholds)).toBeGreaterThan(1);
		expect(levelOf(5, thresholds)).toBe(4);
	});

	it("回数が 0 でも、記録があった日は段階 1 にする", () => {
		expect(levelOf(0, [3, 6, 9], true)).toBe(1);
		expect(levelOf(0, [3, 6, 9], false)).toBe(0);
	});

	it("境界が無いときは、正の値をすべて段階 1 にする", () => {
		expect(levelOf(5, [])).toBe(1);
	});
});
