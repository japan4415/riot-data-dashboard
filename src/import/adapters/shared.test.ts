import { describe, expect, it } from "vitest";
import { durationSec, ipAddress, outcome, spent } from "./shared.ts";

describe("durationSec", () => {
	it("開始と終了の差を秒で返す", () => {
		expect(durationSec(1_000, 61_000)).toBe(60);
	});

	it("どちらかが無い、または逆転している場合は null", () => {
		expect(durationSec(null, 1_000)).toBeNull();
		expect(durationSec(1_000, null)).toBeNull();
		expect(durationSec(2_000, 1_000)).toBeNull();
	});
});

describe("outcome", () => {
	it("ゲームごとの表記をそろえる", () => {
		expect(outcome("Win")).toBe("win");
		expect(outcome("Victory")).toBe("win");
		expect(outcome("Loss")).toBe("loss");
		expect(outcome("Defeat")).toBe("loss");
	});

	it("それ以外は none", () => {
		expect(outcome("Noncompetitive")).toBe("none");
		expect(outcome(null)).toBe("none");
		expect(outcome(1)).toBe("none");
	});
});

describe("ipAddress", () => {
	it("IPv4 と IPv6 を読む", () => {
		expect(ipAddress("203.0.113.7")).toBe("203.0.113.7");
		expect(ipAddress("2001:DB8::1")).toBe("2001:db8::1");
	});

	it.each([
		["Unknown"],
		["0.0.0.0"],
		["1.1.1.1"],
		["unknown.host1.ab1"],
		["999.0.0.1"],
		[""],
		[null],
	])("IP アドレスでない値は null: %s", (input) => {
		expect(ipAddress(input)).toBeNull();
	});
});

describe("spent", () => {
	it("支払いを負の増減にする", () => {
		expect(spent("VALORANT Points", 1000)).toEqual([
			{ currency: "VALORANT Points", amount: -1000 },
		]);
	});

	it("通貨名が無い、または量が正でない場合は空", () => {
		expect(spent(null, 10)).toEqual([]);
		expect(spent("Coins", 0)).toEqual([]);
		expect(spent("Coins", null)).toEqual([]);
	});
});
