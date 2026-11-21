import { describe, expect, it } from "vitest";
import { runAdapter, utc } from "../testing.ts";
import {
	accountAuditV1,
	accountAuditV2,
	accountInfo,
	clash,
	summoner,
} from "./account.ts";

describe("accountInfo", () => {
	it("アカウントの基本情報を正規化する", () => {
		const { result, skipped } = runAdapter(accountInfo, {
			username: "tester_user",
			game_name: "Tester",
			tagline: "JP1",
			email: "player@example.com",
			date_of_birth: "1990-04-05",
		});

		expect(skipped).toBe(0);
		expect(result).toEqual({
			account: {
				riotId: { gameName: "Tester", tagLine: "JP1" },
				username: "tester_user",
				email: "player@example.com",
				dateOfBirth: "1990-04-05",
			},
		});
	});

	it("前後の空白を取り除く", () => {
		const { result } = runAdapter(accountInfo, {
			game_name: " Tester ",
			tagline: "JP1\n",
		});

		expect(result.account?.riotId).toEqual({
			gameName: "Tester",
			tagLine: "JP1",
		});
	});

	it.each([
		["ゲーム名が無い", { tagline: "JP1" }],
		["タグラインが無い", { game_name: "Tester" }],
		["ゲーム名が空文字列", { game_name: "", tagline: "JP1" }],
		["タグラインが null", { game_name: "Tester", tagline: null }],
		["ゲーム名が文字列でない", { game_name: 1, tagline: "JP1" }],
	])("%s場合は Riot ID を設定しない", (_name, input) => {
		const { result } = runAdapter(accountInfo, input);

		expect(result.account).toEqual({});
	});

	it.each([
		["2020/01/02"],
		["20200102"],
		["1990-4-5"],
		["1990-04-05T00:00:00Z"],
		[""],
		[19900405],
		[null],
	])("生年月日 %j が YYYY-MM-DD でなければ設定しない", (value) => {
		const { result } = runAdapter(accountInfo, { date_of_birth: value });

		expect(result.account).toEqual({});
	});

	it("値が null や空の項目はキーごと省く", () => {
		const { result } = runAdapter(accountInfo, {
			username: null,
			email: "",
			game_name: "Tester",
			tagline: "JP1",
		});

		expect(result.account).toEqual({
			riotId: { gameName: "Tester", tagLine: "JP1" },
		});
		expect(Object.keys(result.account ?? {})).toEqual(["riotId"]);
	});

	it.each([[null], ["broken"], [42], [[]], [[{ username: "tester_user" }]]])(
		"オブジェクトでない入力 %j は飛ばして空の結果を返す",
		(input) => {
			const { result, skipped } = runAdapter(accountInfo, input);

			expect(skipped).toBe(1);
			expect(result).toEqual({});
		},
	);

	it("知らない項目は無視する", () => {
		const { result } = runAdapter(accountInfo, {
			username: "tester_user",
			unexpected: "value",
		});

		expect(result).toEqual({ account: { username: "tester_user" } });
	});
});

describe("summoner", () => {
	it("プラットフォームと Riot ID を読む", () => {
		const { result, skipped } = runAdapter(summoner, {
			lol_platform: "JP1",
			riot_id: "Tester#JP1",
		});

		expect(skipped).toBe(0);
		expect(result).toEqual({
			account: {
				lolPlatform: "JP1",
				riotId: { gameName: "Tester", tagLine: "JP1" },
			},
		});
	});

	it("最後の # で分ける", () => {
		const { result } = runAdapter(summoner, { riot_id: "Test#er#JP1" });

		expect(result.account?.riotId).toEqual({
			gameName: "Test#er",
			tagLine: "JP1",
		});
	});

	it.each([
		["# が無い", "TesterJP1"],
		["ゲーム名が空", "#JP1"],
		["タグラインが空", "Tester#"],
		["空白だけの側がある", "  #JP1"],
		["空文字列", ""],
		["文字列でない", 42],
		["null", null],
	])("Riot ID が読めない（%s）場合は設定しない", (_name, value) => {
		const { result } = runAdapter(summoner, {
			lol_platform: "JP1",
			riot_id: value,
		});

		expect(result.account).toEqual({ lolPlatform: "JP1" });
	});

	it("オブジェクトでない入力は飛ばす", () => {
		const { result, skipped } = runAdapter(summoner, ["Tester#JP1"]);

		expect(skipped).toBe(1);
		expect(result).toEqual({});
	});
});

describe("clash", () => {
	it("電話番号を読む", () => {
		const { result, skipped } = runAdapter(clash, {
			phone_number: "+81******1234",
		});

		expect(skipped).toBe(0);
		expect(result).toEqual({ account: { phoneNumber: "+81******1234" } });
	});

	it.each([[null], [""], [81], [undefined]])(
		"電話番号が %j のときは設定しない",
		(value) => {
			const { result } = runAdapter(clash, { phone_number: value });

			expect(result.account).toEqual({});
		},
	);

	it("オブジェクトでない入力は飛ばす", () => {
		const { result, skipped } = runAdapter(clash, null);

		expect(skipped).toBe(1);
		expect(result).toEqual({});
	});
});

describe("accountAuditV1", () => {
	it("出来事を正規化する", () => {
		const { result, skipped } = runAdapter(accountAuditV1, [
			{ action: "PASSWORD_CHANGED", event_date: "2018-05-06 07:08:09" },
		]);

		expect(skipped).toBe(0);
		expect(result.accountEvents).toEqual([
			{
				at: utc("2018-05-06T07:08:09Z"),
				type: "PASSWORD_CHANGED",
				description: null,
				source: "v1",
			},
		]);
	});

	it("末尾が .0 の日時も読む", () => {
		const { result } = runAdapter(accountAuditV1, [
			{ action: "ACCOUNT_STATE_CHANGED", event_date: "2013-01-02 03:04:05.0" },
		]);

		expect(result.accountEvents?.[0]?.at).toBe(utc("2013-01-02T03:04:05Z"));
	});

	it("v1 は補足の項目があっても読まない", () => {
		const { result } = runAdapter(accountAuditV1, [
			{
				action: "PASSWORD_CHANGED",
				event_date: "2018-05-06 07:08:09",
				description: "ignored",
			},
		]);

		expect(result.accountEvents?.[0]?.description).toBeNull();
	});

	it("日時か種類が読めない行と、オブジェクトでない行は飛ばす", () => {
		const { result, skipped } = runAdapter(accountAuditV1, [
			{ action: "PASSWORD_CHANGED", event_date: "not a date" },
			{ action: "PASSWORD_CHANGED" },
			{ action: null, event_date: "2018-05-06 07:08:09" },
			{ action: "", event_date: "2018-05-06 07:08:09" },
			"broken",
			null,
			{ action: "PASSWORD_CHANGED", event_date: "2018-05-06 07:08:09" },
		]);

		expect(skipped).toBe(6);
		expect(result.accountEvents).toHaveLength(1);
	});

	it("配列でない入力には空の結果を返す", () => {
		expect(runAdapter(accountAuditV1, { unexpected: true }).result).toEqual({
			accountEvents: [],
		});
		expect(runAdapter(accountAuditV1, null).result).toEqual({
			accountEvents: [],
		});
	});
});

describe("accountAuditV2", () => {
	it("出来事を正規化する", () => {
		const { result, skipped } = runAdapter(accountAuditV2, [
			{
				event_type: "USER_FIELD_CHANGED",
				description: "username",
				event_date: "2021-02-03 04:05:06",
			},
		]);

		expect(skipped).toBe(0);
		expect(result.accountEvents).toEqual([
			{
				at: utc("2021-02-03T04:05:06Z"),
				type: "USER_FIELD_CHANGED",
				description: "username",
				source: "v2",
			},
		]);
	});

	it.each([
		["null", null],
		["空文字列", ""],
		["文字列でない", 1],
		["項目が無い", undefined],
	])("補足が %s の場合は null にする", (_name, description) => {
		const { result } = runAdapter(accountAuditV2, [
			{
				event_type: "ANOMALOUS_ACTIVITY",
				description,
				event_date: "2021-02-03 04:05:06",
			},
		]);

		expect(result.accountEvents?.[0]?.description).toBeNull();
	});

	it("v2 は action ではなく event_type を種類として読む", () => {
		const { result, skipped } = runAdapter(accountAuditV2, [
			{ action: "PASSWORD_CHANGED", event_date: "2021-02-03 04:05:06" },
		]);

		expect(skipped).toBe(1);
		expect(result.accountEvents).toEqual([]);
	});

	it("日時か種類が読めない行と、オブジェクトでない行は飛ばす", () => {
		const { result, skipped } = runAdapter(accountAuditV2, [
			{ event_type: "EMAIL", event_date: null },
			{ event_type: null, event_date: "2021-02-03 04:05:06" },
			42,
			{
				event_type: "EMAIL",
				description: "delivered",
				event_date: "2021-02-03 04:05:06",
			},
		]);

		expect(skipped).toBe(3);
		expect(result.accountEvents).toHaveLength(1);
	});

	it("配列でない入力には空の結果を返す", () => {
		expect(runAdapter(accountAuditV2, "broken").result).toEqual({
			accountEvents: [],
		});
	});
});
