import { describe, expect, it } from "vitest";
import { epochMs, parseDateTime, timestamp } from "./parseDate.ts";

const utc = (iso: string) => Date.parse(iso);

describe("parseDateTime", () => {
	it.each([
		["A: 秒まで", "2020-01-02 03:04:05", "2020-01-02T03:04:05.000Z"],
		["B: 末尾が .0", "2013-01-02 03:04:05.0", "2013-01-02T03:04:05.000Z"],
		["C: 小数秒 1 桁", "2020-01-02 03:04:05.1", "2020-01-02T03:04:05.100Z"],
		["C: 小数秒 3 桁", "2020-01-02 03:04:05.123", "2020-01-02T03:04:05.123Z"],
		[
			"C: 小数秒 6 桁",
			"2020-01-02 03:04:05.123456",
			"2020-01-02T03:04:05.123Z",
		],
		[
			"D: コロンなしのオフセット",
			"2019-01-02T03:04:05.123456+0000",
			"2019-01-02T03:04:05.123Z",
		],
		[
			"E: コロンありのオフセット",
			"2021-01-02T03:04:05.123456+00:00",
			"2021-01-02T03:04:05.123Z",
		],
		[
			"F: 小数秒 7 桁",
			"2020-01-02T03:04:05.1234567+00:00",
			"2020-01-02T03:04:05.123Z",
		],
		["H: Z で終わる", "2018-01-02T03:04:05Z", "2018-01-02T03:04:05.000Z"],
	])("%s", (_name, input, expected) => {
		expect(parseDateTime(input)).toEqual({
			at: utc(expected),
			dateOnly: false,
		});
	});

	it("G: 日付だけの値は、その日の 0 時（UTC）として扱う", () => {
		expect(parseDateTime("2026-01-02")).toEqual({
			at: utc("2026-01-02T00:00:00.000Z"),
			dateOnly: true,
		});
	});

	it("UTC 以外のオフセットを UTC に直す", () => {
		expect(timestamp("2020-01-02T12:00:00+09:00")).toBe(
			utc("2020-01-02T03:00:00.000Z"),
		);
		expect(timestamp("2020-01-02T03:00:00-0530")).toBe(
			utc("2020-01-02T08:30:00.000Z"),
		);
	});

	it("前後の空白を無視する", () => {
		expect(timestamp("  2020-01-02 03:04:05\n")).toBe(
			utc("2020-01-02T03:04:05.000Z"),
		);
	});

	it.each([
		["空文字列", ""],
		["日時でない文字列", "Unknown"],
		["存在しない月", "2020-13-01 00:00:00"],
		["存在しない日", "2021-02-30 00:00:00"],
		["存在しない時刻", "2020-01-02 25:00:00"],
		["区切りが違う", "2020/01/02 03:04:05"],
		["数値", 1700000000000],
		["null", null],
		["undefined", undefined],
	])("読めない値は null を返す: %s", (_name, input) => {
		expect(parseDateTime(input)).toBeNull();
		expect(timestamp(input)).toBeNull();
	});
});

describe("epochMs", () => {
	it("ミリ秒の数値をそのまま返す", () => {
		expect(epochMs(1700000000000)).toBe(1700000000000);
	});

	it.each([
		["文字列", "1700000000000"],
		["負の数", -1],
		["NaN", Number.NaN],
		["無限大", Number.POSITIVE_INFINITY],
		["null", null],
	])("読めない値は null を返す: %s", (_name, input) => {
		expect(epochMs(input)).toBeNull();
	});
});
