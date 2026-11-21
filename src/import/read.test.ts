import { describe, expect, it } from "vitest";
import {
	amountX100,
	asArray,
	body,
	bool,
	int,
	isRecord,
	known,
	num,
	records,
	text,
} from "./read.ts";

describe("isRecord / asArray / records", () => {
	it("オブジェクトだけを record とみなす", () => {
		expect(isRecord({})).toBe(true);
		expect(isRecord([])).toBe(false);
		expect(isRecord(null)).toBe(false);
		expect(isRecord("x")).toBe(false);
	});

	it("配列でない値は空配列にする", () => {
		expect(asArray([1, 2])).toEqual([1, 2]);
		expect(asArray({})).toEqual([]);
		expect(asArray(null)).toEqual([]);
	});

	it("配列からオブジェクトだけを取り出す", () => {
		expect(records([{ a: 1 }, null, "x", [1], { b: 2 }])).toEqual([
			{ a: 1 },
			{ b: 2 },
		]);
	});
});

describe("text", () => {
	it("前後の空白と改行を取り除く", () => {
		expect(text("  Agent Store \n")).toBe("Agent Store");
	});

	it("途中の改行を空白 1 つに置き換える", () => {
		expect(text("Level 7\r\n(Variant 3)")).toBe("Level 7 (Variant 3)");
	});

	it("空文字列と文字列以外は null", () => {
		expect(text("")).toBeNull();
		expect(text("   ")).toBeNull();
		expect(text(12)).toBeNull();
		expect(text(null)).toBeNull();
	});

	it("「値なし」を表す文字列はそのまま返す", () => {
		expect(text("Unknown")).toBe("Unknown");
	});
});

describe("body", () => {
	it("途中の改行を保つ", () => {
		expect(body(" 1 行目\r\n2 行目 \n")).toBe("1 行目\n2 行目");
	});

	it("空文字列は null", () => {
		expect(body(" \n ")).toBeNull();
	});
});

describe("known", () => {
	it.each(["Unknown", "unknown", "Not Applicable", "None", "null", ""])(
		"「値なし」を表す文字列は null: %s",
		(input) => {
			expect(known(input)).toBeNull();
		},
	);

	it("それ以外は text と同じ", () => {
		expect(known(" Ranked ")).toBe("Ranked");
	});
});

describe("num / int", () => {
	it("数値と数値の文字列を読む", () => {
		expect(num(12.5)).toBe(12.5);
		expect(num("10748")).toBe(10748);
		expect(num(" -3.5 ")).toBe(-3.5);
	});

	it("数値として読めない値は null", () => {
		expect(num("12abc")).toBeNull();
		expect(num("")).toBeNull();
		expect(num(Number.NaN)).toBeNull();
		expect(num(true)).toBeNull();
		expect(num(null)).toBeNull();
	});

	it("int は小数を null にする", () => {
		expect(int("590")).toBe(590);
		expect(int(3)).toBe(3);
		expect(int(3.5)).toBeNull();
		expect(int("3.5")).toBeNull();
	});
});

describe("bool", () => {
	it("真偽値、0 と 1、その文字列を読む", () => {
		expect(bool(true)).toBe(true);
		expect(bool(false)).toBe(false);
		expect(bool("1")).toBe(true);
		expect(bool("0")).toBe(false);
		expect(bool(1)).toBe(true);
		expect(bool(0)).toBe(false);
	});

	it("それ以外は null", () => {
		expect(bool(null)).toBeNull();
		expect(bool("yes")).toBeNull();
		expect(bool(2)).toBeNull();
	});
});

describe("amountX100", () => {
	it.each([
		["12.0", 1200],
		["12.00", 1200],
		["1300.00", 130000],
		["5", 500],
		["0.5", 50],
		["19.99", 1999],
		["19.999", 1999],
		[" 7.25 ", 725],
		["-3.10", -310],
	])("文字列 %s を %d にする", (input, expected) => {
		expect(amountX100(input)).toBe(expected);
	});

	it("数値も受け付ける", () => {
		expect(amountX100(35)).toBe(3500);
		expect(amountX100(0.1)).toBe(10);
	});

	it("金額として読めない値は null", () => {
		expect(amountX100("abc")).toBeNull();
		expect(amountX100("")).toBeNull();
		expect(amountX100(null)).toBeNull();
		expect(amountX100("1,000")).toBeNull();
	});
});
