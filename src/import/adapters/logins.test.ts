import { describe, expect, it } from "vitest";
import { runAdapter, utc } from "../testing.ts";
import { logins } from "./logins.ts";

function row(overrides: Record<string, unknown> = {}) {
	return {
		event_time_utc: "2024-03-01 10:00:00",
		event_type: "Login",
		product: "League/TFT PC",
		ip_address: "203.0.113.7",
		...overrides,
	};
}

describe("logins", () => {
	it("ログイン記録を正規化する", () => {
		const { result, skipped } = runAdapter(logins, [row()]);

		expect(skipped).toBe(0);
		expect(result.logins).toEqual([
			{
				at: utc("2024-03-01T10:00:00Z"),
				target: "lol-tft-pc",
				rawProduct: "League/TFT PC",
				kind: "login",
				rawType: "Login",
				ip: "203.0.113.7",
			},
		]);
	});

	it.each([
		["League/TFT PC", "lol-tft-pc"],
		["lol", "lol-tft-pc"],
		["TFTm", "tft-mobile"],
		["TFT", "tft-mobile"],
		["VALORANT", "valorant"],
		["Wild Rift", "wildrift"],
		["Legends of Runeterra", "lor"],
		["riot_client", "riot-account"],
		["rso-prod", "riot-account"],
		["rso-authenticator-prod", "riot-account"],
		["2XKO", "other"],
		["something-new", "other"],
	])("product の %s を %s に対応づける", (product, expected) => {
		const { result } = runAdapter(logins, [row({ product })]);

		expect(result.logins?.[0]?.target).toBe(expected);
		expect(result.logins?.[0]?.rawProduct).toBe(product);
	});

	it.each([
		["valorant", "valorant"],
		["LEAGUE/TFT PC", "lol-tft-pc"],
		["tftM", "tft-mobile"],
		["WILD RIFT", "wildrift"],
	])("product の大文字小文字を区別しない（%s）", (product, expected) => {
		const { result } = runAdapter(logins, [row({ product })]);

		expect(result.logins?.[0]?.target).toBe(expected);
	});

	it.each([
		["null", null],
		["項目が無い", undefined],
		["空文字列", ""],
	])("product が %s の場合は Riot アカウント共通にする", (_name, product) => {
		const { result } = runAdapter(logins, [row({ product })]);

		expect(result.logins?.[0]).toMatchObject({
			target: "riot-account",
			rawProduct: null,
		});
	});

	it.each([
		["Login", "login"],
		["Connected", "login"],
		["Session Start", "login"],
		["Logout", "logout"],
		["Logout User", "logout"],
		["Logout Deadpool", "logout"],
		["Logout Kick", "logout"],
		["Login Kick", "logout"],
		["Closed", "logout"],
		["Purged", "logout"],
		["Expired", "logout"],
		["Session Expired", "logout"],
		["Session Kicked Out", "logout"],
		["Authentication", "auth"],
		["Refresh", "auth"],
		["Disconnect", "disconnect"],
		["Replace", "other"],
		["Something New", "other"],
	])("event_type の %s を %s に対応づける", (eventType, expected) => {
		const { result } = runAdapter(logins, [row({ event_type: eventType })]);

		expect(result.logins?.[0]?.kind).toBe(expected);
		expect(result.logins?.[0]?.rawType).toBe(eventType);
	});

	it.each([
		["LOGIN", "login"],
		["logout user", "logout"],
		["session KICKED out", "logout"],
		["disconnect", "disconnect"],
	])("event_type の大文字小文字を区別しない（%s）", (eventType, expected) => {
		const { result } = runAdapter(logins, [row({ event_type: eventType })]);

		expect(result.logins?.[0]?.kind).toBe(expected);
	});

	it.each([
		["Unknown", null],
		["unknown", null],
		[null, null],
		[undefined, null],
		["", null],
		["0.0.0.0", null],
		["not-an-ip-address", null],
		["999.1.1.1", null],
		["2001:DB8::1", "2001:db8::1"],
		["203.0.113.7", "203.0.113.7"],
	])("IP アドレス %j を %j にする", (ip, expected) => {
		const { result } = runAdapter(logins, [row({ ip_address: ip })]);

		expect(result.logins?.[0]?.ip).toBe(expected);
	});

	it("日時が読めない行、種類が無い行、オブジェクトでない行は飛ばす", () => {
		const { result, skipped } = runAdapter(logins, [
			row({ event_time_utc: null }),
			row({ event_time_utc: "yesterday" }),
			row({ event_type: null }),
			row({ event_type: "" }),
			"broken",
			null,
			row(),
		]);

		expect(skipped).toBe(6);
		expect(result.logins).toHaveLength(1);
	});

	it("日時の書式が混ざっていても読む", () => {
		const { result } = runAdapter(logins, [
			row({ event_time_utc: "2016-01-02 03:04:05" }),
			row({ event_time_utc: "2016-01-02T03:04:05Z" }),
		]);

		expect(result.logins?.map((event) => event.at)).toEqual([
			utc("2016-01-02T03:04:05Z"),
			utc("2016-01-02T03:04:05Z"),
		]);
	});

	it("並び順を変えずに返す", () => {
		const { result } = runAdapter(logins, [
			row({ event_time_utc: "2024-03-02 00:00:00" }),
			row({ event_time_utc: "2024-03-01 00:00:00" }),
		]);

		expect(result.logins?.map((event) => event.at)).toEqual([
			utc("2024-03-02T00:00:00Z"),
			utc("2024-03-01T00:00:00Z"),
		]);
	});

	it("配列でない入力には空の結果を返す", () => {
		expect(runAdapter(logins, { unexpected: true }).result).toEqual({
			logins: [],
		});
		expect(runAdapter(logins, null).result).toEqual({ logins: [] });
	});
});
