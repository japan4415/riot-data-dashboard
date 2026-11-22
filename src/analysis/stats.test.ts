import { describe, expect, it } from "vitest";
import { extent, median } from "./stats.ts";

describe("median", () => {
	it("件数が奇数なら、中央の値を返す", () => {
		expect(median([30, 5, 20])).toBe(20);
	});

	it("件数が偶数なら、中央の 2 つの平均を返す", () => {
		expect(median([40, 20])).toBe(30);
		expect(median([5, 20, 30, 40])).toBe(25);
	});

	it("値が無ければ null", () => {
		expect(median([])).toBeNull();
	});

	it("渡した配列を並べ替えない", () => {
		const values = [3, 1, 2];
		median(values);
		expect(values).toEqual([3, 1, 2]);
	});
});

describe("extent", () => {
	it("最小値と最大値を返す", () => {
		expect(extent([3, -1, 7, 2])).toEqual({ min: -1, max: 7 });
		expect(extent([4])).toEqual({ min: 4, max: 4 });
	});

	it("値が無ければ null", () => {
		expect(extent([])).toBeNull();
	});

	it("件数が多くても求められる", () => {
		const values = Array.from({ length: 300_000 }, (_, index) => index);
		expect(extent(values)).toEqual({ min: 0, max: 299_999 });
	});
});
