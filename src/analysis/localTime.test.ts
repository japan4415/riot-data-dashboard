import { describe, expect, it } from "vitest";
import {
	browserLocal,
	fixedOffset,
	startOfMonth,
	startOfYear,
} from "./localTime.ts";
import { at } from "./testing.ts";

const jst = fixedOffset(540);

describe("startOfMonth / startOfYear", () => {
	it("利用者のタイムゾーンで、月が始まる時刻を返す", () => {
		// 日本時間の 3 月 1 日 0 時は、UTC では 2 月 29 日 15 時
		expect(startOfMonth(2024, 3, jst)).toBe(at("2024-02-29T15:00:00Z"));
		expect(startOfYear(2024, jst)).toBe(at("2023-12-31T15:00:00Z"));
	});

	it("UTC より遅れているタイムゾーンでも求められる", () => {
		const pst = fixedOffset(-480);
		expect(startOfYear(2024, pst)).toBe(at("2024-01-01T08:00:00Z"));
	});

	it("13 以上の月は、翌年の月として扱う", () => {
		expect(startOfMonth(2024, 13, jst)).toBe(startOfYear(2025, jst));
		expect(startOfMonth(2024, 14, jst)).toBe(startOfMonth(2025, 2, jst));
	});

	it("求めた時刻の直前は、前の月になる", () => {
		const start = startOfMonth(2024, 5, jst);
		expect(jst(start)).toMatchObject({ year: 2024, month: 5, day: 1, hour: 0 });
		expect(jst(start - 1)).toMatchObject({ month: 4, day: 30 });
	});

	it("ブラウザのタイムゾーンでも求められる", () => {
		// テストは日本時間で実行する
		expect(startOfYear(2024, browserLocal)).toBe(
			new Date(2024, 0, 1).getTime(),
		);
	});
});
