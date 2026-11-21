import { describe, expect, it } from "vitest";
import { runAdapter, utc } from "../testing.ts";
import { lolPayments } from "./lolPayments.ts";

function row(overrides: Record<string, unknown> = {}) {
	return {
		transaction_id: "JP1-00000000-0000-4000-8000-000000000001",
		transaction_number: "N-0001",
		created: "2020-01-02 03:04:05",
		amount: "1300.00",
		currency_type: "JPY",
		payment_type: "paypal",
		store_account_id: 1,
		user_ip: "203.0.113.7",
		...overrides,
	};
}

describe("lolPayments", () => {
	it("支払いを正規化する", () => {
		const { result, skipped } = runAdapter(lolPayments, [row()]);

		expect(skipped).toBe(0);
		expect(result.payments).toEqual([
			{
				game: "lol",
				id: "JP1-00000000-0000-4000-8000-000000000001",
				at: utc("2020-01-02T03:04:05Z"),
				currency: "JPY",
				amountX100: 130000,
				method: "paypal",
				granted: null,
				ip: "203.0.113.7",
			},
		]);
	});

	it.each([
		["12.0", 1200],
		["12.00", 1200],
		["1300.00", 130000],
		["9.99", 999],
		["0.5", 50],
		["35", 3500],
		[12, 1200],
	])("金額 %j を 100 倍の整数 %i にする", (amount, expected) => {
		const { result } = runAdapter(lolPayments, [row({ amount })]);

		expect(result.payments?.[0]?.amountX100).toBe(expected);
	});

	it.each([
		["2013-01-02 03:04:05.0", "2013-01-02T03:04:05Z"],
		["2020-01-02 03:04:05", "2020-01-02T03:04:05Z"],
	])("日時 %s を読む", (created, expected) => {
		const { result, skipped } = runAdapter(lolPayments, [row({ created })]);

		expect(skipped).toBe(0);
		expect(result.payments?.[0]?.at).toBe(utc(expected));
	});

	it("通貨コードの前後の空白を取り除き、大文字にそろえる", () => {
		const { result } = runAdapter(lolPayments, [
			row({ currency_type: " usd " }),
		]);

		expect(result.payments?.[0]?.currency).toBe("USD");
	});

	it("決済手段は元の表記のまま残し、無ければ null にする", () => {
		const { result } = runAdapter(lolPayments, [
			row({ payment_type: " softbank-creditcard " }),
			row({ payment_type: "" }),
			row({ payment_type: null }),
		]);

		expect(result.payments?.map((p) => p.method)).toEqual([
			"softbank-creditcard",
			null,
			null,
		]);
	});

	it.each([
		["203.0.113.7", "203.0.113.7"],
		["0.0.0.0", null],
		["Unknown", null],
		[null, null],
	])("user_ip %j は %j", (address, expected) => {
		const { result } = runAdapter(lolPayments, [row({ user_ip: address })]);

		expect(result.payments?.[0]?.ip).toBe(expected);
	});

	it("取引 ID が無い行も残す", () => {
		const { result, skipped } = runAdapter(lolPayments, [
			row({ transaction_id: null }),
		]);

		expect(skipped).toBe(0);
		expect(result.payments?.[0]?.id).toBeNull();
	});

	it.each([
		["日時が無い", { created: null }],
		["日時が読めない", { created: "yesterday" }],
		["通貨コードが無い", { currency_type: null }],
		["通貨コードが空", { currency_type: "  " }],
		["金額が無い", { amount: null }],
		["金額が読めない", { amount: "free" }],
	])("%s行は飛ばす", (_name, overrides) => {
		const { result, skipped } = runAdapter(lolPayments, [
			row(overrides),
			row(),
		]);

		expect(skipped).toBe(1);
		expect(result.payments).toHaveLength(1);
	});

	it("オブジェクトでない行は飛ばす", () => {
		const { result, skipped } = runAdapter(lolPayments, ["broken", null, 1]);

		expect(skipped).toBe(3);
		expect(result.payments).toEqual([]);
	});

	it("知らない項目は無視する", () => {
		const { result, skipped } = runAdapter(lolPayments, [
			row({ brand_new_field: [1, 2, 3] }),
		]);

		expect(skipped).toBe(0);
		expect(result.payments).toHaveLength(1);
	});

	it("配列でない入力には空の結果を返す", () => {
		expect(runAdapter(lolPayments, { unexpected: true }).result).toEqual({
			payments: [],
		});
		expect(runAdapter(lolPayments, null).result).toEqual({ payments: [] });
	});
});
