import { describe, expect, it } from "vitest";
import { queueLabel, queueText } from "./queues.ts";

describe("queueLabel / queueText", () => {
	it("一般的な名前は、そのまま表示する", () => {
		expect(queueLabel("Ranked")).toEqual({ label: "Ranked", raw: null });
		expect(queueText("Spike Rush")).toBe("Spike Rush");
	});

	it("対応が分かっているコード名は表示名に直し、元の値を添える", () => {
		expect(queueLabel("Hurm")).toEqual({
			label: "Team Deathmatch",
			raw: "Hurm",
		});
		expect(queueText("Ggteam")).toBe("Escalation（Ggteam）");
		// 大文字小文字の違いは区別しない
		expect(queueText("ONEFA")).toBe("Replication（ONEFA）");
	});

	it("対応が分からないコード名は、元の値のまま表示する", () => {
		expect(queueText("Fortcollins")).toBe("Fortcollins");
	});

	it("名前の記録が無いものは、その旨を表示する", () => {
		expect(queueText(null)).toBe("種別の記録なし");
	});

	it("オブジェクトが元から持つ名前を、表示名として扱わない", () => {
		for (const name of ["__proto__", "constructor", "toString"]) {
			expect(queueLabel(name)).toEqual({ label: name, raw: null });
		}
	});
});
