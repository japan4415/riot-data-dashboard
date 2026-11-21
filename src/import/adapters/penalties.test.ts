import { describe, expect, it } from "vitest";
import { runAdapter, utc } from "../testing.ts";
import { penalties } from "./penalties.ts";

function row(overrides: Record<string, unknown> = {}) {
	return {
		date_issued: "2018-01-02T03:04:05Z",
		scope: "LEAGUE_OF_LEGENDS",
		restriction_type: "CHAT_RESTRICTION",
		restriction_reason: "DISRUPTIVE_COMMUNICATION",
		sentence: "TIMEOUT",
		status: "LAPSED",
		is_manual: false,
		...overrides,
	};
}

describe("penalties", () => {
	it("ペナルティを正規化する", () => {
		const { result, skipped } = runAdapter(penalties, [row()]);

		expect(skipped).toBe(0);
		expect(result.penalties).toEqual([
			{
				at: utc("2018-01-02T03:04:05Z"),
				scope: "LEAGUE_OF_LEGENDS",
				restrictionType: "CHAT_RESTRICTION",
				reason: "DISRUPTIVE_COMMUNICATION",
				sentence: "TIMEOUT",
				status: "LAPSED",
				isManual: false,
			},
		]);
	});

	it.each([
		[true, true],
		[false, false],
		[1, true],
		["0", false],
		["yes", null],
		[null, null],
		[undefined, null],
	])("is_manual の %j を %j として読む", (value, expected) => {
		const { result } = runAdapter(penalties, [row({ is_manual: value })]);

		expect(result.penalties?.[0]?.isManual).toBe(expected);
	});

	it.each([
		["null", null],
		["読めない文字列", "not a date"],
		["数値", 1514775845000],
		["項目が無い", undefined],
	])("日時が %s でも行は残し、at を null にする", (_name, value) => {
		const { result, skipped } = runAdapter(penalties, [
			row({ date_issued: value }),
		]);

		expect(skipped).toBe(0);
		expect(result.penalties).toHaveLength(1);
		expect(result.penalties?.[0]?.at).toBeNull();
	});

	it("値なしを表す文字列と空の項目は null にする", () => {
		const { result } = runAdapter(penalties, [
			row({
				scope: "Unknown",
				restriction_type: "Not Applicable",
				restriction_reason: "",
				sentence: null,
				status: 1,
			}),
		]);

		expect(result.penalties?.[0]).toMatchObject({
			scope: null,
			restrictionType: null,
			reason: null,
			sentence: null,
			status: null,
		});
	});

	it("空のオブジェクトの行も、すべて null のペナルティとして残す", () => {
		const { result, skipped } = runAdapter(penalties, [{}]);

		expect(skipped).toBe(0);
		expect(result.penalties).toEqual([
			{
				at: null,
				scope: null,
				restrictionType: null,
				reason: null,
				sentence: null,
				status: null,
				isManual: null,
			},
		]);
	});

	it("オブジェクトでない行だけを飛ばす", () => {
		const { result, skipped } = runAdapter(penalties, [
			"broken",
			null,
			42,
			[],
			row(),
		]);

		expect(skipped).toBe(4);
		expect(result.penalties).toHaveLength(1);
	});

	it("配列でない入力には空の結果を返す", () => {
		expect(runAdapter(penalties, { unexpected: true }).result).toEqual({
			penalties: [],
		});
		expect(runAdapter(penalties, null).result).toEqual({ penalties: [] });
	});

	it("空配列には空の結果を返す", () => {
		const { result, skipped } = runAdapter(penalties, []);

		expect(skipped).toBe(0);
		expect(result).toEqual({ penalties: [] });
	});
});
