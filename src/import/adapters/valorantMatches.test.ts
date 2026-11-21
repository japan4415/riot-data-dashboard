import { describe, expect, it } from "vitest";
import { runAdapter, utc } from "../testing.ts";
import { valorantMatches } from "./valorantMatches.ts";

function row(overrides: Record<string, unknown> = {}) {
	return {
		game_id: "00000000-0000-4000-8000-000000000001",
		game_start_time_utc: "2024-03-01 10:00:00",
		game_end_time_utc: "2024-03-01 10:35:30",
		game_mode: "Matchmaking",
		game_type: "Ranked",
		game_outcome: "Win",
		realm_id: "ap",
		...overrides,
	};
}

describe("valorantMatches", () => {
	it("試合を正規化する", () => {
		const { result, skipped } = runAdapter(valorantMatches, [row()]);

		expect(skipped).toBe(0);
		expect(result.matches).toEqual([
			{
				game: "valorant",
				id: "00000000-0000-4000-8000-000000000001",
				startedAt: utc("2024-03-01T10:00:00Z"),
				endedAt: utc("2024-03-01T10:35:30Z"),
				durationSec: 2130,
				queue: {
					category: "ranked",
					rawMode: "Matchmaking",
					rawType: "Ranked",
				},
				outcome: "win",
				countsForWinRate: true,
				realm: "ap",
			},
		]);
	});

	it.each([
		["Matchmaking", "Ranked", "ranked"],
		["Matchmaking", "Unrated", "normal"],
		["Matchmaking", "Swiftplay", "normal"],
		["Matchmaking", "Spike Rush", "other"],
		["Matchmaking", "Hurm", "other"],
		["Matchmaking", "Unknown", "other"],
		["Custom Game", "Not Applicable", "custom"],
		["Tournament", "Not Applicable", "custom"],
		["ShootingRange", "Not Applicable", "practice"],
		["New Player Experience", "Not Applicable", "practice"],
	])("%s / %s を %s に区分する", (mode, type, expected) => {
		const { result } = runAdapter(valorantMatches, [
			row({ game_mode: mode, game_type: type }),
		]);

		expect(result.matches?.[0]?.queue.category).toBe(expected);
	});

	it("値なしを表す種別は null にする", () => {
		const { result } = runAdapter(valorantMatches, [
			row({ game_mode: "Custom Game", game_type: "Not Applicable" }),
		]);

		expect(result.matches?.[0]?.queue).toEqual({
			category: "custom",
			rawMode: "Custom Game",
			rawType: null,
		});
	});

	it("射撃場は勝敗なしとして扱い、勝率に数えない", () => {
		const { result } = runAdapter(valorantMatches, [
			row({
				game_mode: "ShootingRange",
				game_type: "Not Applicable",
				game_outcome: "Loss",
			}),
		]);

		expect(result.matches?.[0]).toMatchObject({
			outcome: "none",
			countsForWinRate: false,
		});
	});

	it("Deathmatch は勝敗を保つが、勝率に数えない", () => {
		const { result } = runAdapter(valorantMatches, [
			row({ game_type: "Deathmatch", game_outcome: "Loss" }),
		]);

		expect(result.matches?.[0]).toMatchObject({
			outcome: "loss",
			countsForWinRate: false,
		});
	});

	it("日時が読めない試合も残し、長さを null にする", () => {
		const { result, skipped } = runAdapter(valorantMatches, [
			row({ game_end_time_utc: null }),
		]);

		expect(skipped).toBe(0);
		expect(result.matches?.[0]).toMatchObject({
			endedAt: null,
			durationSec: null,
		});
	});

	it("ID が無い行と、オブジェクトでない行は飛ばす", () => {
		const { result, skipped } = runAdapter(valorantMatches, [
			row({ game_id: null }),
			"broken",
			null,
			row(),
		]);

		expect(skipped).toBe(3);
		expect(result.matches).toHaveLength(1);
	});

	it("配列でない入力には空の結果を返す", () => {
		expect(runAdapter(valorantMatches, { unexpected: true }).result).toEqual({
			matches: [],
		});
		expect(runAdapter(valorantMatches, null).result).toEqual({ matches: [] });
	});
});
