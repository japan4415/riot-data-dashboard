import { describe, expect, it } from "vitest";
import type { GameId } from "../../model/types.ts";
import { runAdapter } from "../testing.ts";
import { groupedReports } from "./reports.ts";

describe("groupedReports", () => {
	it("した側とされた側の件数を正規化する", () => {
		const { result, skipped } = runAdapter(groupedReports("lol"), {
			reports_made: { LEAVING_AFK: 2, RANK_MANIPULATION: 1 },
			reports_received: { ASSISTING_ENEMY_TEAM: 3 },
		});

		expect(skipped).toBe(0);
		expect(result.reports).toEqual([
			{ game: "lol", direction: "made", category: "LEAVING_AFK", count: 2 },
			{
				game: "lol",
				direction: "made",
				category: "RANK_MANIPULATION",
				count: 1,
			},
			{
				game: "lol",
				direction: "received",
				category: "ASSISTING_ENEMY_TEAM",
				count: 3,
			},
		]);
	});

	it.each<GameId>(["lol", "tft", "valorant"])(
		"渡したゲーム %s を結果に付ける",
		(game) => {
			const { result } = runAdapter(groupedReports(game), {
				reports_made: { LEAVING_AFK: 1 },
				reports_received: { LEAVING_AFK: 1 },
			});

			expect(result.reports?.map((report) => report.game)).toEqual([
				game,
				game,
			]);
		},
	);

	it("片方だけがある場合は、その向きだけを返す", () => {
		const { result } = runAdapter(groupedReports("tft"), {
			reports_received: { LEAVING_AFK: 4 },
		});

		expect(result.reports).toEqual([
			{ game: "tft", direction: "received", category: "LEAVING_AFK", count: 4 },
		]);
	});

	it("空のオブジェクトには空の配列を返す", () => {
		const adapter = groupedReports("valorant");

		expect(runAdapter(adapter, {}).result).toEqual({ reports: [] });
		expect(
			runAdapter(adapter, { reports_made: {}, reports_received: {} }),
		).toEqual({ result: { reports: [] }, skipped: 0 });
	});

	it("文字列の件数も整数として読む", () => {
		const { result } = runAdapter(groupedReports("lol"), {
			reports_made: { LEAVING_AFK: "5" },
		});

		expect(result.reports?.[0]?.count).toBe(5);
	});

	it("0 件は有効な件数として残す", () => {
		const { result, skipped } = runAdapter(groupedReports("lol"), {
			reports_made: { LEAVING_AFK: 0 },
		});

		expect(skipped).toBe(0);
		expect(result.reports?.[0]?.count).toBe(0);
	});

	it.each([
		["負の数", -1],
		["小数", 1.5],
		["数値でない文字列", "many"],
		["null", null],
		["真偽値", true],
		["オブジェクト", { count: 1 }],
		["NaN", Number.NaN],
	])("件数が %s の分類は飛ばす", (_name, value) => {
		const { result, skipped } = runAdapter(groupedReports("lol"), {
			reports_made: { BAD: value, LEAVING_AFK: 2 },
		});

		expect(skipped).toBe(1);
		expect(result.reports).toEqual([
			{ game: "lol", direction: "made", category: "LEAVING_AFK", count: 2 },
		]);
	});

	it("空の分類名は飛ばし、前後の空白は取り除く", () => {
		const { result, skipped } = runAdapter(groupedReports("lol"), {
			reports_made: { "": 1, " LEAVING_AFK ": 2 },
		});

		expect(skipped).toBe(1);
		expect(result.reports).toEqual([
			{ game: "lol", direction: "made", category: "LEAVING_AFK", count: 2 },
		]);
	});

	it("向きの値がオブジェクトでない場合は無視する", () => {
		const { result, skipped } = runAdapter(groupedReports("lol"), {
			reports_made: [1, 2],
			reports_received: "broken",
		});

		expect(skipped).toBe(0);
		expect(result.reports).toEqual([]);
	});

	it("知らない項目は無視する", () => {
		const { result } = runAdapter(groupedReports("lol"), {
			unexpected: { LEAVING_AFK: 1 },
			reports_made: { LEAVING_AFK: 1 },
		});

		expect(result.reports).toHaveLength(1);
	});

	it("オブジェクトでない入力には空の結果を返す", () => {
		const adapter = groupedReports("lol");

		expect(runAdapter(adapter, [{ reports_made: { A: 1 } }]).result).toEqual({
			reports: [],
		});
		expect(runAdapter(adapter, null).result).toEqual({ reports: [] });
		expect(runAdapter(adapter, "broken").result).toEqual({ reports: [] });
	});
});
