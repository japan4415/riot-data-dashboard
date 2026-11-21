import { describe, expect, it } from "vitest";
import { runAdapter, utc } from "../testing.ts";
import { valorantPayments, valorantPurchases } from "./valorant.ts";

function payment(overrides: Record<string, unknown> = {}) {
	return {
		player_facing_purchase_id: "ABCDEF123456",
		payment_time_utc: "2024-03-01 10:00:00",
		payment_method: "paypal",
		country_code: "JP",
		currency_code: "JPY",
		real_currency_paid_x100: 100000,
		game_currency_granted: 1650,
		game_currency_type: "VP",
		recipient_id: null,
		...overrides,
	};
}

describe("valorantPayments", () => {
	it("支払いを正規化する", () => {
		const { result, skipped } = runAdapter(valorantPayments, [payment()]);

		expect(skipped).toBe(0);
		expect(result.payments).toEqual([
			{
				game: "valorant",
				id: "ABCDEF123456",
				at: utc("2024-03-01T10:00:00Z"),
				currency: "JPY",
				amountX100: 100000,
				method: "paypal",
				granted: { currency: "VP", amount: 1650 },
				ip: null,
			},
		]);
	});

	it("通貨コードは前後の空白を取り、大文字にそろえる", () => {
		const { result } = runAdapter(valorantPayments, [
			payment({ currency_code: " jpy " }),
		]);

		expect(result.payments?.[0]?.currency).toBe("JPY");
	});

	it("支払額は 100 倍された値のまま読み、数値の文字列も受け付ける", () => {
		const { result } = runAdapter(valorantPayments, [
			payment({ real_currency_paid_x100: "50000" }),
		]);

		expect(result.payments?.[0]?.amountX100).toBe(50000);
	});

	it("付与された通貨の種類が無いときは VP とみなす", () => {
		const { result } = runAdapter(valorantPayments, [
			payment({ game_currency_type: null }),
		]);

		expect(result.payments?.[0]?.granted).toEqual({
			currency: "VP",
			amount: 1650,
		});
	});

	it.each([
		["null", null],
		["欠けた値", undefined],
		["小数", 12.5],
		["文字列", "many"],
	])("付与量が%sのときは granted を null にする", (_label, value) => {
		const { result, skipped } = runAdapter(valorantPayments, [
			payment({ game_currency_granted: value }),
		]);

		expect(skipped).toBe(0);
		expect(result.payments?.[0]?.granted).toBeNull();
	});

	it("ID と決済手段が無くても、支払いは残す", () => {
		const { result, skipped } = runAdapter(valorantPayments, [
			payment({ player_facing_purchase_id: null, payment_method: "" }),
		]);

		expect(skipped).toBe(0);
		expect(result.payments?.[0]).toMatchObject({ id: null, method: null });
	});

	it.each([
		["日時が無い", { payment_time_utc: null }],
		["日時が読めない", { payment_time_utc: "yesterday" }],
		["通貨コードが無い", { currency_code: null }],
		["通貨コードが空", { currency_code: "  " }],
		["金額が無い", { real_currency_paid_x100: null }],
		["金額が小数", { real_currency_paid_x100: 1000.5 }],
	])("%s行は飛ばす", (_label, overrides) => {
		const { result, skipped } = runAdapter(valorantPayments, [
			payment(overrides),
		]);

		expect(skipped).toBe(1);
		expect(result.payments).toEqual([]);
	});

	it("オブジェクトでない行は飛ばす", () => {
		const { result, skipped } = runAdapter(valorantPayments, [
			"broken",
			null,
			payment(),
		]);

		expect(skipped).toBe(2);
		expect(result.payments).toHaveLength(1);
	});

	it("配列でない入力には空の結果を返す", () => {
		expect(runAdapter(valorantPayments, { unexpected: true }).result).toEqual({
			payments: [],
		});
		expect(runAdapter(valorantPayments, null).result).toEqual({
			payments: [],
		});
	});
});

function purchase(overrides: Record<string, unknown> = {}) {
	return {
		transaction_id: "T-0001",
		purchase_date: "2024-03-01 10:00:00.123",
		transaction_type: "Purchase",
		transaction_source: "Bundle",
		item_type: "Bundle",
		item_name: "Sample Bundle",
		spent_currency_name: "VALORANT Points",
		spent_currency_amount: 2000,
		...overrides,
	};
}

describe("valorantPurchases", () => {
	it("取引を正規化する", () => {
		const { result, skipped } = runAdapter(valorantPurchases, [purchase()]);

		expect(skipped).toBe(0);
		expect(result.transactions).toEqual([
			{
				game: "valorant",
				id: "T-0001",
				at: utc("2024-03-01T10:00:00.123Z"),
				kind: "purchase",
				rawKind: "Purchase",
				source: "Bundle",
				item: {
					name: "Sample Bundle",
					rawId: null,
					category: "Bundle",
					quantity: null,
				},
				deltas: [{ currency: "VALORANT Points", amount: -2000 }],
				balances: [],
				refunded: null,
				ip: null,
			},
		]);
	});

	it.each([
		["Purchase", "purchase"],
		["Unlock", "purchase"],
		["purchase", "purchase"],
		["UNLOCK", "purchase"],
		["Refund", "other"],
		["", "other"],
	])("取引の種類 %s を %s に区分する", (rawType, expected) => {
		const { result } = runAdapter(valorantPurchases, [
			purchase({ transaction_type: rawType }),
		]);

		expect(result.transactions?.[0]?.kind).toBe(expected);
	});

	it("種類が無いときは other にして、元の値を null にする", () => {
		const { result } = runAdapter(valorantPurchases, [
			purchase({ transaction_type: null }),
		]);

		expect(result.transactions?.[0]).toMatchObject({
			kind: "other",
			rawKind: null,
		});
	});

	it.each([
		["1 桁", "2024-03-01 10:00:00.1", "2024-03-01T10:00:00.100Z"],
		["3 桁", "2024-03-01 10:00:00.123", "2024-03-01T10:00:00.123Z"],
		["6 桁", "2024-03-01 10:00:00.123456", "2024-03-01T10:00:00.123Z"],
		["小数秒なし", "2024-03-01 10:00:00", "2024-03-01T10:00:00.000Z"],
	])("日時の小数秒が%sでも読める", (_label, value, expected) => {
		const { result, skipped } = runAdapter(valorantPurchases, [
			purchase({ purchase_date: value }),
		]);

		expect(skipped).toBe(0);
		expect(result.transactions?.[0]?.at).toBe(utc(expected));
	});

	it("経路の先頭の空白と、品目名の改行を取り除く", () => {
		const { result } = runAdapter(valorantPurchases, [
			purchase({
				transaction_source: " Gun Upgrade",
				item_name: "Sample Skin\r\nLevel 2",
			}),
		]);

		expect(result.transactions?.[0]?.source).toBe("Gun Upgrade");
		expect(result.transactions?.[0]?.item.name).toBe("Sample Skin Level 2");
	});

	it.each([
		["null", null],
		["0", 0],
		["負の値", -5],
		["文字列", "many"],
	])("支払量が%sのときは増減を空にする", (_label, amount) => {
		const { result, skipped } = runAdapter(valorantPurchases, [
			purchase({ spent_currency_amount: amount }),
		]);

		expect(skipped).toBe(0);
		expect(result.transactions?.[0]?.deltas).toEqual([]);
	});

	it("通貨名が無いときは増減を空にする", () => {
		const { result } = runAdapter(valorantPurchases, [
			purchase({ spent_currency_name: null }),
		]);

		expect(result.transactions?.[0]?.deltas).toEqual([]);
	});

	it("ID や品目が無くても、取引は残す", () => {
		const { result, skipped } = runAdapter(valorantPurchases, [
			purchase({ transaction_id: null, item_name: null, item_type: null }),
		]);

		expect(skipped).toBe(0);
		expect(result.transactions?.[0]).toMatchObject({
			id: null,
			item: { name: null, category: null },
		});
	});

	it("日時が無い、または読めない行と、オブジェクトでない行は飛ばす", () => {
		const { result, skipped } = runAdapter(valorantPurchases, [
			purchase({ purchase_date: null }),
			purchase({ purchase_date: "unknown" }),
			"broken",
			null,
			purchase(),
		]);

		expect(skipped).toBe(4);
		expect(result.transactions).toHaveLength(1);
	});

	it("配列でない入力には空の結果を返す", () => {
		expect(runAdapter(valorantPurchases, "text").result).toEqual({
			transactions: [],
		});
		expect(runAdapter(valorantPurchases, { a: 1 }).result).toEqual({
			transactions: [],
		});
	});
});
