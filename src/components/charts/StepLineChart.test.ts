import { describe, expect, it } from "vitest";
import { nearestIndex } from "./StepLineChart.tsx";

const points = [10, 20, 40].map((x) => ({ x, y: 0 }));

describe("nearestIndex", () => {
	it("もっとも近い点の位置を返す", () => {
		expect(nearestIndex(points, 11)).toBe(0);
		expect(nearestIndex(points, 19)).toBe(1);
		expect(nearestIndex(points, 29)).toBe(1);
		expect(nearestIndex(points, 31)).toBe(2);
	});

	it("点とちょうど重なるときは、その点を返す", () => {
		expect(nearestIndex(points, 20)).toBe(1);
	});

	it("同じ距離なら、右の点を返す", () => {
		expect(nearestIndex(points, 15)).toBe(1);
		expect(nearestIndex(points, 30)).toBe(2);
	});

	it("範囲の外では、端の点を返す", () => {
		expect(nearestIndex(points, -100)).toBe(0);
		expect(nearestIndex(points, 100)).toBe(2);
	});

	it("点が 1 つでも返せる", () => {
		expect(nearestIndex([{ x: 5, y: 0 }], 99)).toBe(0);
	});
});
