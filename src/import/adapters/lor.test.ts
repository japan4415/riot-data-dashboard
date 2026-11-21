import { describe, expect, it } from "vitest";
import { runAdapter, utc } from "../testing.ts";
import { lorMatches, lorPayments, lorPurchases } from "./lor.ts";

function match(overrides: Record<string, unknown> = {}) {
	return {
		game_id: "00000000-0000-4000-8000-000000000001",
		game_start_time_utc: "2021-05-01T10:00:00.123456+00:00",
		game_end_time_utc: "2021-05-01T10:20:00.123456+00:00",
		game_time_seconds: 1190,
		play_time_seconds: 1190,
		total_turn_count: 9,
		order_of_play: 1,
		game_mode: "Constructed",
		game_type: "Ranked",
		is_ai: false,
		game_outcome: "Victory",
		game_outcome_reason: "Zero Health",
		deck_id: "00000000-0000-4000-8000-0000000000d1",
		faction1: "Demacia",
		faction2: "Shadow Isles",
		faction3: "Unknown",
		platform: "Windows",
		realm_id: "asia",
		country: "Unknown",
		...overrides,
	};
}

describe("lorMatches", () => {
	it("試合を正規化する", () => {
		const { result, skipped } = runAdapter(lorMatches, [match()]);

		expect(skipped).toBe(0);
		expect(result.matches).toEqual([
			{
				game: "lor",
				id: "00000000-0000-4000-8000-000000000001",
				startedAt: utc("2021-05-01T10:00:00.123Z"),
				endedAt: utc("2021-05-01T10:20:00.123Z"),
				durationSec: 1190,
				queue: {
					category: "ranked",
					rawMode: "Constructed",
					rawType: "Ranked",
				},
				outcome: "win",
				countsForWinRate: true,
				deckId: "00000000-0000-4000-8000-0000000000d1",
				factions: ["Demacia", "Shadow Isles"],
				turnCount: 9,
				outcomeReason: "Zero Health",
				platform: "Windows",
				orderOfPlay: 1,
				realm: "asia",
			},
		]);
	});

	it.each([
		["Constructed", "Ranked", "ranked"],
		["Constructed", "Normal", "normal"],
		["Constructed", "AI", "practice"],
		["Constructed", "ai", "practice"],
		["Tutorial Basics", "Normal", "practice"],
		["tutorial basics", "Ranked", "practice"],
		["Constructed", "Unknown", "other"],
		["Constructed", "Something", "other"],
		["Unknown", "Unknown", "other"],
	])("%s / %s を %s に区分する", (mode, type, expected) => {
		const { result } = runAdapter(lorMatches, [
			match({ game_mode: mode, game_type: type }),
		]);

		expect(result.matches?.[0]?.queue.category).toBe(expected);
	});

	it("値なしを表す種別は null にする", () => {
		const { result } = runAdapter(lorMatches, [
			match({ game_mode: "Unknown", game_type: "Not Applicable" }),
		]);

		expect(result.matches?.[0]?.queue).toEqual({
			category: "other",
			rawMode: null,
			rawType: null,
		});
	});

	it.each([
		["Victory", "win"],
		["Defeat", "loss"],
		["Win", "win"],
		["Loss", "loss"],
		["Draw", "none"],
		[null, "none"],
	])("勝敗 %s を %s に読む", (value, expected) => {
		const { result } = runAdapter(lorMatches, [match({ game_outcome: value })]);

		expect(result.matches?.[0]?.outcome).toBe(expected);
	});

	it("練習の試合は勝敗を保つが、勝率に数えない", () => {
		const { result } = runAdapter(lorMatches, [
			match({ game_type: "AI", game_outcome: "Defeat", is_ai: false }),
		]);

		expect(result.matches?.[0]).toMatchObject({
			queue: { category: "practice" },
			outcome: "loss",
			countsForWinRate: false,
		});
	});

	it("勝敗が無い試合は勝率に数えない", () => {
		const { result } = runAdapter(lorMatches, [
			match({ game_outcome: "Unknown" }),
		]);

		expect(result.matches?.[0]).toMatchObject({
			outcome: "none",
			countsForWinRate: false,
		});
	});

	it("is_ai は読まない", () => {
		const { result } = runAdapter(lorMatches, [
			match({ is_ai: true, game_type: "Ranked" }),
		]);

		expect(result.matches?.[0]?.queue.category).toBe("ranked");
	});

	it.each([
		[
			"+0000 の書式",
			"2019-01-02T03:04:05.123456+0000",
			"2019-01-02T03:04:05.123Z",
		],
		[
			"+00:00 の書式",
			"2021-01-02T03:04:05.123456+00:00",
			"2021-01-02T03:04:05.123Z",
		],
	])("日時の%sを読める", (_label, value, expected) => {
		const { result, skipped } = runAdapter(lorMatches, [
			match({ game_start_time_utc: value }),
		]);

		expect(skipped).toBe(0);
		expect(result.matches?.[0]?.startedAt).toBe(utc(expected));
	});

	it.each([
		["正の値", 90, 90],
		["0", 0, 1200],
		["負の値", -5, 1200],
		["null", null, 1200],
		["小数", 12.5, 1200],
		["数値の文字列", "75", 75],
	])("試合時間が%sのときの長さを決める", (_label, value, expected) => {
		const { result } = runAdapter(lorMatches, [
			match({ game_time_seconds: value }),
		]);

		expect(result.matches?.[0]?.durationSec).toBe(expected);
	});

	it("試合時間も日時も読めないときは、長さを null にする", () => {
		const { result, skipped } = runAdapter(lorMatches, [
			match({
				game_time_seconds: 0,
				game_start_time_utc: null,
				game_end_time_utc: "broken",
			}),
		]);

		expect(skipped).toBe(0);
		expect(result.matches?.[0]).toMatchObject({
			startedAt: null,
			endedAt: null,
			durationSec: null,
		});
	});

	it("地域は Unknown と欠けた値を除き、順序を保つ", () => {
		const { result } = runAdapter(lorMatches, [
			match({ faction1: "Unknown", faction2: "Noxus", faction3: "Ionia" }),
			match({ faction1: "Demacia", faction2: undefined, faction3: "" }),
			match({ faction1: null, faction2: null, faction3: null }),
		]);

		expect(
			result.matches?.map((m) => (m.game === "lor" ? m.factions : null)),
		).toEqual([["Noxus", "Ionia"], ["Demacia"], []]);
	});

	it("値なしの項目は null にする", () => {
		const { result } = runAdapter(lorMatches, [
			match({
				deck_id: "Unknown",
				total_turn_count: null,
				game_outcome_reason: "Unknown",
				platform: null,
				order_of_play: "x",
				realm_id: "Unknown",
			}),
		]);

		expect(result.matches?.[0]).toMatchObject({
			deckId: null,
			turnCount: null,
			outcomeReason: null,
			platform: null,
			orderOfPlay: null,
			realm: null,
		});
	});

	it("ID が無い行と、オブジェクトでない行は飛ばす", () => {
		const { result, skipped } = runAdapter(lorMatches, [
			match({ game_id: null }),
			"broken",
			null,
			match(),
		]);

		expect(skipped).toBe(3);
		expect(result.matches).toHaveLength(1);
	});

	it("配列でない入力には空の結果を返す", () => {
		expect(runAdapter(lorMatches, { unexpected: true }).result).toEqual({
			matches: [],
		});
		expect(runAdapter(lorMatches, null).result).toEqual({ matches: [] });
	});
});

function payment(overrides: Record<string, unknown> = {}) {
	return {
		player_facing_purchase_id: "ABCDEF123456",
		payment_time_utc: "2022-03-01 10:00:00",
		payment_method: "paypal",
		is_prepaid_card: false,
		country_code: "JPN",
		currency_code: "JPY",
		real_currency_paid_x100: 120000,
		game_currency_granted: 575,
		...overrides,
	};
}

describe("lorPayments", () => {
	it("支払いを正規化する", () => {
		const { result, skipped } = runAdapter(lorPayments, [payment()]);

		expect(skipped).toBe(0);
		expect(result.payments).toEqual([
			{
				game: "lor",
				id: "ABCDEF123456",
				at: utc("2022-03-01T10:00:00Z"),
				currency: "JPY",
				amountX100: 120000,
				method: "paypal",
				granted: { currency: "Coins", amount: 575 },
				ip: null,
			},
		]);
	});

	it("通貨コードは前後の空白を取り、大文字にそろえる", () => {
		const { result } = runAdapter(lorPayments, [
			payment({ currency_code: " usd" }),
		]);

		expect(result.payments?.[0]?.currency).toBe("USD");
	});

	it("付与された通貨は、元データに種類があっても Coins にする", () => {
		const { result } = runAdapter(lorPayments, [
			payment({ game_currency_type: "VP" }),
		]);

		expect(result.payments?.[0]?.granted).toEqual({
			currency: "Coins",
			amount: 575,
		});
	});

	it.each([
		["null", null],
		["欠けた値", undefined],
		["小数", 1.5],
	])("付与量が%sのときは granted を null にする", (_label, value) => {
		const { result, skipped } = runAdapter(lorPayments, [
			payment({ game_currency_granted: value }),
		]);

		expect(skipped).toBe(0);
		expect(result.payments?.[0]?.granted).toBeNull();
	});

	it.each([
		["日時が無い", { payment_time_utc: null }],
		["通貨コードが無い", { currency_code: null }],
		["金額が無い", { real_currency_paid_x100: null }],
	])("%s行は飛ばす", (_label, overrides) => {
		const { result, skipped } = runAdapter(lorPayments, [payment(overrides)]);

		expect(skipped).toBe(1);
		expect(result.payments).toEqual([]);
	});

	it("オブジェクトでない行は飛ばす", () => {
		const { result, skipped } = runAdapter(lorPayments, [42, payment()]);

		expect(skipped).toBe(1);
		expect(result.payments).toHaveLength(1);
	});

	it("配列でない入力には空の結果を返す", () => {
		expect(runAdapter(lorPayments, {}).result).toEqual({ payments: [] });
		expect(runAdapter(lorPayments, undefined).result).toEqual({
			payments: [],
		});
	});
});

function purchase(overrides: Record<string, unknown> = {}) {
	return {
		transaction_id: "00000000-0000-4000-8000-0000000000a1",
		purchase_time_utc: "2022-03-01T10:00:00.1234567+00:00",
		purchased_item_name: "Sample Card",
		purchased_item_type: "Card",
		purchased_item_amount: 3,
		purchased_item_new_balance: 10,
		spent_item_name: "Coins",
		spent_item_type: "Coin",
		spent_item_amount: 300,
		spent_item_new_balance: 1200,
		runtime_platform: "Windows",
		realm_id: "asia",
		transaction_source: "DEPRECATED",
		ip_address: null,
		...overrides,
	};
}

describe("lorPurchases", () => {
	it("取引を正規化する", () => {
		const { result, skipped } = runAdapter(lorPurchases, [purchase()]);

		expect(skipped).toBe(0);
		expect(result.transactions).toEqual([
			{
				game: "lor",
				id: "00000000-0000-4000-8000-0000000000a1",
				at: utc("2022-03-01T10:00:00.123Z"),
				kind: "purchase",
				rawKind: null,
				source: "DEPRECATED",
				item: {
					name: "Sample Card",
					rawId: null,
					category: "Card",
					quantity: 3,
				},
				deltas: [{ currency: "Coins", amount: -300 }],
				balances: [{ currency: "Coins", amount: 1200 }],
				refunded: null,
				ip: null,
			},
		]);
	});

	it("同じ取引 ID の行をすべて残す", () => {
		const { result, skipped } = runAdapter(lorPurchases, [
			purchase({ purchased_item_name: "Card A" }),
			purchase({ purchased_item_name: "Card B" }),
		]);

		expect(skipped).toBe(0);
		expect(result.transactions?.map((t) => t.item.name)).toEqual([
			"Card A",
			"Card B",
		]);
		expect(new Set(result.transactions?.map((t) => t.id)).size).toBe(1);
	});

	it("支払った通貨の名前が無いときは、種別を通貨名に使う", () => {
		const { result } = runAdapter(lorPurchases, [
			purchase({ spent_item_name: null, spent_item_type: "Shard" }),
		]);

		expect(result.transactions?.[0]).toMatchObject({
			deltas: [{ currency: "Shard", amount: -300 }],
			balances: [{ currency: "Shard", amount: 1200 }],
		});
	});

	it("通貨の名前も種別も無いときは、増減も残高も空にする", () => {
		const { result, skipped } = runAdapter(lorPurchases, [
			purchase({ spent_item_name: null, spent_item_type: null }),
		]);

		expect(skipped).toBe(0);
		expect(result.transactions?.[0]).toMatchObject({
			deltas: [],
			balances: [],
		});
	});

	it("支払量が 0 のときは増減を空にして、残高は残す", () => {
		const { result } = runAdapter(lorPurchases, [
			purchase({ spent_item_amount: 0 }),
		]);

		expect(result.transactions?.[0]).toMatchObject({
			deltas: [],
			balances: [{ currency: "Coins", amount: 1200 }],
		});
	});

	it("支払後の残高が読めないときは、残高を空にする", () => {
		const { result } = runAdapter(lorPurchases, [
			purchase({ spent_item_new_balance: null }),
			purchase({ spent_item_new_balance: "x" }),
		]);

		expect(result.transactions?.map((t) => t.balances)).toEqual([[], []]);
	});

	it("数値の文字列も整数として読む", () => {
		const { result } = runAdapter(lorPurchases, [
			purchase({ purchased_item_amount: "2", spent_item_amount: "50" }),
		]);

		expect(result.transactions?.[0]?.item.quantity).toBe(2);
		expect(result.transactions?.[0]?.deltas).toEqual([
			{ currency: "Coins", amount: -50 },
		]);
	});

	it("ID や品目が無くても、取引は残す", () => {
		const { result, skipped } = runAdapter(lorPurchases, [
			purchase({
				transaction_id: null,
				purchased_item_name: null,
				purchased_item_type: null,
				purchased_item_amount: null,
				transaction_source: null,
			}),
		]);

		expect(skipped).toBe(0);
		expect(result.transactions?.[0]).toMatchObject({
			id: null,
			source: null,
			item: { name: null, category: null, quantity: null },
		});
	});

	it("日時が無い、または読めない行と、オブジェクトでない行は飛ばす", () => {
		const { result, skipped } = runAdapter(lorPurchases, [
			purchase({ purchase_time_utc: null }),
			purchase({ purchase_time_utc: "broken" }),
			[],
			purchase(),
		]);

		expect(skipped).toBe(3);
		expect(result.transactions).toHaveLength(1);
	});

	it("配列でない入力には空の結果を返す", () => {
		expect(runAdapter(lorPurchases, { unexpected: true }).result).toEqual({
			transactions: [],
		});
		expect(runAdapter(lorPurchases, null).result).toEqual({
			transactions: [],
		});
	});
});
