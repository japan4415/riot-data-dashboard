import { describe, expect, it } from "vitest";
import { runAdapter, utc } from "../testing.ts";
import { chatLog } from "./chatLogs.ts";

function message(overrides: Record<string, unknown> = {}) {
	return {
		chat: "hello",
		riot_id: "Tester#JP1",
		sent_to: "TEAM",
		timestamp: 1_700_000_000_000,
		...overrides,
	};
}

function file(overrides: Record<string, unknown> = {}) {
	return {
		game_id: 1234567890,
		platform_id: "jp1",
		match_date_utc: "2026-01-02",
		success: true,
		was_failure: false,
		chat_logs: {
			pre_game: [],
			in_game: [message()],
			post_game: [],
		},
		...overrides,
	};
}

describe("chatLog", () => {
	it("LoL の試合を正規化する", () => {
		const { result, skipped } = runAdapter(chatLog("lol"), file());

		expect(skipped).toBe(0);
		expect(result.chatLogs).toEqual([
			{
				game: "lol",
				gameId: "1234567890",
				matchDate: utc("2026-01-02T00:00:00Z"),
				matchDateIsDateOnly: true,
				platform: "jp1",
				messages: [
					{
						phase: "inGame",
						at: 1_700_000_000_000,
						sender: "Tester#JP1",
						sentTo: "TEAM",
						text: "hello",
					},
				],
			},
		]);
	});

	it("TFT の試合日は日時として読み、日付のみの印を付けない", () => {
		const { result } = runAdapter(
			chatLog("tft"),
			file({
				match_date_utc: "2026-01-02T03:04:05.123456+00:00",
				match_id: "JP1_1234567890",
				product: "tft",
			}),
		);

		expect(result.chatLogs?.[0]).toMatchObject({
			game: "tft",
			gameId: "1234567890",
			matchDate: utc("2026-01-02T03:04:05.123Z"),
			matchDateIsDateOnly: false,
		});
	});

	it.each([
		["2026-01-02 03:04:05", "2026-01-02T03:04:05Z", false],
		["2026-01-02", "2026-01-02T00:00:00Z", true],
	])("試合日 %s を読む", (matchDate, expected, dateOnly) => {
		const { result } = runAdapter(
			chatLog("lol"),
			file({ match_date_utc: matchDate }),
		);

		expect(result.chatLogs?.[0]).toMatchObject({
			matchDate: utc(expected),
			matchDateIsDateOnly: dateOnly,
		});
	});

	it.each([null, undefined, "", "last week", 20260102])(
		"試合日 %j が読めなければ null にする",
		(matchDate) => {
			const { result, skipped } = runAdapter(
				chatLog("lol"),
				file({ match_date_utc: matchDate }),
			);

			expect(skipped).toBe(0);
			expect(result.chatLogs?.[0]).toMatchObject({
				matchDate: null,
				matchDateIsDateOnly: false,
			});
		},
	);

	it("発言を、試合前、試合中、試合後の順に並べる", () => {
		const { result } = runAdapter(
			chatLog("lol"),
			file({
				chat_logs: {
					post_game: [message({ chat: "gg" })],
					in_game: [message({ chat: "mid" })],
					pre_game: [message({ chat: "hi" }), message({ chat: "ready" })],
				},
			}),
		);

		expect(
			result.chatLogs?.[0]?.messages.map((m) => [m.phase, m.text]),
		).toEqual([
			["preGame", "hi"],
			["preGame", "ready"],
			["inGame", "mid"],
			["postGame", "gg"],
		]);
	});

	it("発言の本文は途中の改行を保つ", () => {
		const { result } = runAdapter(
			chatLog("lol"),
			file({
				chat_logs: {
					in_game: [message({ chat: "  line1\r\nline2\nline3  " })],
				},
			}),
		);

		expect(result.chatLogs?.[0]?.messages[0]?.text).toBe("line1\nline2\nline3");
	});

	it("宛先がパーティの発言を読む", () => {
		const { result } = runAdapter(
			chatLog("tft"),
			file({
				chat_logs: { in_game: [message({ sent_to: "PARTY_42" })] },
			}),
		);

		expect(result.chatLogs?.[0]?.messages[0]?.sentTo).toBe("PARTY_42");
	});

	it("発言者、宛先、時刻が読めなくても発言は残す", () => {
		const { result, skipped } = runAdapter(
			chatLog("lol"),
			file({
				chat_logs: {
					in_game: [
						message({ riot_id: null, sent_to: "", timestamp: "soon" }),
						message({ timestamp: -1 }),
					],
				},
			}),
		);

		expect(skipped).toBe(0);
		expect(result.chatLogs?.[0]?.messages).toMatchObject([
			{ at: null, sender: null, sentTo: null },
			{ at: null, sender: "Tester#JP1", sentTo: "TEAM" },
		]);
	});

	it("本文が無い発言と、オブジェクトでない発言は飛ばして数える", () => {
		const { result, skipped } = runAdapter(
			chatLog("lol"),
			file({
				chat_logs: {
					pre_game: [message({ chat: null }), "broken"],
					in_game: [message({ chat: "   " }), message({ chat: 5 }), message()],
					post_game: [null],
				},
			}),
		);

		expect(skipped).toBe(5);
		expect(result.chatLogs?.[0]?.messages).toHaveLength(1);
	});

	it("発言が無い試合も 1 件の記録にする", () => {
		const { result, skipped } = runAdapter(
			chatLog("lol"),
			file({ chat_logs: { pre_game: [], in_game: [], post_game: [] } }),
		);

		expect(skipped).toBe(0);
		expect(result.chatLogs).toHaveLength(1);
		expect(result.chatLogs?.[0]?.messages).toEqual([]);
	});

	it.each([
		["chat_logs が無い", undefined],
		["chat_logs が null", null],
		["chat_logs が配列", []],
		["chat_logs が文字列", "none"],
		["局面の値が配列でない", { pre_game: "x", in_game: {}, post_game: null }],
	])("%sときは発言なしとして読む", (_name, chatLogs) => {
		const { result, skipped } = runAdapter(
			chatLog("lol"),
			file({ chat_logs: chatLogs }),
		);

		expect(skipped).toBe(0);
		expect(result.chatLogs).toHaveLength(1);
		expect(result.chatLogs?.[0]?.messages).toEqual([]);
	});

	it.each([
		[1234567890, "1234567890"],
		["1234567890", "1234567890"],
		[" JP1_55 ", "JP1_55"],
	])("game_id %j を文字列 %s にする", (gameId, expected) => {
		const { result } = runAdapter(chatLog("lol"), file({ game_id: gameId }));

		expect(result.chatLogs?.[0]?.gameId).toBe(expected);
	});

	it.each([
		["無い", undefined],
		["null", null],
		["空文字列", ""],
		["小数", 1.5],
		["真偽値", true],
		["オブジェクト", {}],
	])("game_id が%sなら飛ばす", (_name, gameId) => {
		const { result, skipped } = runAdapter(
			chatLog("lol"),
			file({ game_id: gameId }),
		);

		expect(skipped).toBe(1);
		expect(result.chatLogs).toEqual([]);
	});

	it("プラットフォーム ID が無ければ null にする", () => {
		const { result } = runAdapter(chatLog("lol"), file({ platform_id: null }));

		expect(result.chatLogs?.[0]?.platform).toBeNull();
	});

	it("知らない項目は無視する", () => {
		const { result, skipped } = runAdapter(
			chatLog("lol"),
			file({ brand_new_field: [1, 2, 3] }),
		);

		expect(skipped).toBe(0);
		expect(result.chatLogs).toHaveLength(1);
	});

	it.each([
		["配列", [file()]],
		["null", null],
		["文字列", "text"],
		["数値", 7],
	])(
		"オブジェクトでない入力（%s）には空の結果を返し、1 件飛ばす",
		(_name, json) => {
			const { result, skipped } = runAdapter(chatLog("tft"), json);

			expect(skipped).toBe(1);
			expect(result).toEqual({ chatLogs: [] });
		},
	);
});
