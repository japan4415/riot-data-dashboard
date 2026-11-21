import { describe, expect, it } from "vitest";
import { runAdapter, utc } from "../testing.ts";
import { lolItemCategory, lolStore } from "./lolStore.ts";

function row(overrides: Record<string, unknown> = {}) {
	return {
		id: "JP1-00000000-0000-4000-8000-000000000001",
		created: "2020-01-02 03:04:05",
		type: "PURCHASE",
		item_id: "championsskin_1001",
		rp_delta: -975,
		rp_balance: 25,
		ip_delta: 0,
		ip_balance: 4500,
		is_refunded: "0",
		ip_address: "203.0.113.7",
		...overrides,
	};
}

describe("lolStore", () => {
	it("取引を正規化する", () => {
		const { result, skipped } = runAdapter(lolStore, [row()]);

		expect(skipped).toBe(0);
		expect(result.transactions).toEqual([
			{
				game: "lol",
				id: "JP1-00000000-0000-4000-8000-000000000001",
				at: utc("2020-01-02T03:04:05Z"),
				kind: "purchase",
				rawKind: "PURCHASE",
				source: null,
				item: {
					name: null,
					rawId: "championsskin_1001",
					category: "skin",
					quantity: null,
				},
				deltas: [{ currency: "RP", amount: -975 }],
				balances: [
					{ currency: "RP", amount: 25 },
					{ currency: "BE", amount: 4500 },
				],
				refunded: false,
				ip: "203.0.113.7",
			},
		]);
	});

	it.each([
		["PURCHASE", "purchase"],
		["PURCHASE_BUNDLE_ITEM", "purchase"],
		["PURCHASE_NON_REFUNDABLE", "purchase"],
		["MYSTERY_PURCHASE", "purchase"],
		["USER_PURCHASED_RP", "topUp"],
		["USER_PURCHASED_RP_GIFT", "topUp"],
		["PURCHASED_GIFT", "giftSent"],
		["PURCHASED_MYSTERY_GIFT", "giftSent"],
		["ITEM_TRANSFER_SENT", "giftSent"],
		["RP_TRANSFER_SENT", "giftSent"],
		["ITEM_TRANSFER_RECEIVED", "giftReceived"],
		["RP_TRANSFER_RECEIVED", "giftReceived"],
		["REFUND", "refund"],
		["PERK", "reward"],
		["MYSTERY_PERK", "reward"],
		["PROMO_REDEMPTION", "reward"],
		["COMMUNITY_REDEMPTION", "reward"],
		["LEAGUES_REWARD", "reward"],
		["RAF_REWARD", "reward"],
		["SOMETHING_NEW", "other"],
		["", "other"],
		[null, "other"],
		[42, "other"],
	])("type %j を %s に分類する", (type, expected) => {
		const { result } = runAdapter(lolStore, [row({ type })]);

		expect(result.transactions?.[0]?.kind).toBe(expected);
	});

	it("知らない type は元の値を残し、無い type は null にする", () => {
		const { result } = runAdapter(lolStore, [
			row({ type: " SOMETHING_NEW " }),
			row({ type: null }),
		]);

		expect(result.transactions?.map((t) => t.rawKind)).toEqual([
			"SOMETHING_NEW",
			null,
		]);
	});

	it.each([
		["champions_103", "champion"],
		["championsskin_1001", "skin"],
		["summoner_icon_12", "summonerIcon"],
		["emote_5", "emote"],
		["wardskin_3", "wardSkin"],
		["runes_8000", "rune"],
		["hextech_crafting_7", "hextechCrafting"],
		["boosts_2", "boost"],
		["rp_1380", "rp"],
		["currency_9", "currency"],
		["summoner_4", "summoner"],
		["tft_damage_skins_6", "tftDamageSkin"],
		["event_pass_10", "eventPass"],
		["bundles_100", "bundle"],
		["bundles_starter_pack", "bundle"],
		["account_transfer_jp1", "accountTransfer"],
		["account_transfer_12", "accountTransfer"],
		["12345", null],
		["unknown_kind_1", null],
		["", null],
		[null, null],
	])("品目 ID %j の区分は %j", (itemId, expected) => {
		expect(lolItemCategory(itemId)).toBe(expected);
	});

	it("品目 ID が空文字列なら rawId と区分を null にする", () => {
		const { result } = runAdapter(lolStore, [row({ item_id: "" })]);

		expect(result.transactions?.[0]?.item).toEqual({
			name: null,
			rawId: null,
			category: null,
			quantity: null,
		});
	});

	it("RP とブルーエッセンスの増減を分けて持つ", () => {
		const { result } = runAdapter(lolStore, [
			row({ rp_delta: 650, ip_delta: -3150 }),
		]);

		expect(result.transactions?.[0]?.deltas).toEqual([
			{ currency: "RP", amount: 650 },
			{ currency: "BE", amount: -3150 },
		]);
	});

	it("増減が 0、または整数でない通貨は含めない", () => {
		const { result } = runAdapter(lolStore, [
			row({ rp_delta: 0, ip_delta: 0 }),
			row({ rp_delta: 1.5, ip_delta: "abc" }),
			row({ rp_delta: null, ip_delta: undefined }),
		]);

		expect(result.transactions?.map((t) => t.deltas)).toEqual([[], [], []]);
	});

	it("残高は 0 でも残し、整数でないものは含めない", () => {
		const { result } = runAdapter(lolStore, [
			row({ rp_balance: 0, ip_balance: null }),
			row({ rp_balance: "x", ip_balance: 12.5 }),
		]);

		expect(result.transactions?.map((t) => t.balances)).toEqual([
			[{ currency: "RP", amount: 0 }],
			[],
		]);
	});

	it.each([
		["1", true],
		["0", false],
		[null, null],
		[undefined, null],
		["yes", null],
	])("is_refunded %j は %j", (isRefunded, expected) => {
		const { result } = runAdapter(lolStore, [row({ is_refunded: isRefunded })]);

		expect(result.transactions?.[0]?.refunded).toBe(expected);
	});

	it.each([
		["2013-01-02 03:04:05.0", "2013-01-02T03:04:05Z"],
		["2020-01-02 03:04:05", "2020-01-02T03:04:05Z"],
	])("日時 %s を読む", (created, expected) => {
		const { result, skipped } = runAdapter(lolStore, [row({ created })]);

		expect(skipped).toBe(0);
		expect(result.transactions?.[0]?.at).toBe(utc(expected));
	});

	it.each([
		["203.0.113.7", "203.0.113.7"],
		["0.0.0.0", null],
		["1.1.1.1", null],
		["host.example.invalid", null],
		["Unknown", null],
		[null, null],
	])("ip_address %j は %j", (address, expected) => {
		const { result } = runAdapter(lolStore, [row({ ip_address: address })]);

		expect(result.transactions?.[0]?.ip).toBe(expected);
	});

	it("取引 ID が無い行も残す", () => {
		const { result, skipped } = runAdapter(lolStore, [row({ id: null })]);

		expect(skipped).toBe(0);
		expect(result.transactions?.[0]?.id).toBeNull();
	});

	it("日時が読めない行と、オブジェクトでない行は飛ばす", () => {
		const { result, skipped } = runAdapter(lolStore, [
			row({ created: null }),
			row({ created: "yesterday" }),
			row({ created: undefined }),
			"broken",
			null,
			row(),
		]);

		expect(skipped).toBe(5);
		expect(result.transactions).toHaveLength(1);
	});

	it("知らない項目は無視する", () => {
		const { result, skipped } = runAdapter(lolStore, [
			row({ brand_new_field: { nested: true } }),
		]);

		expect(skipped).toBe(0);
		expect(result.transactions).toHaveLength(1);
	});

	it("配列でない入力には空の結果を返す", () => {
		expect(runAdapter(lolStore, { unexpected: true }).result).toEqual({
			transactions: [],
		});
		expect(runAdapter(lolStore, null).result).toEqual({ transactions: [] });
		expect(runAdapter(lolStore, "text").result).toEqual({ transactions: [] });
	});
});
