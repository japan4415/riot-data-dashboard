import { describe, expect, it } from "vitest";
import { runAdapter, utc } from "../testing.ts";
import {
	wildriftCurrency,
	wildriftInventory,
	wildriftMatches,
	wildriftPurchases,
} from "./wildrift.ts";

function match(overrides: Record<string, unknown> = {}) {
	return {
		game_id: "100000000000000001",
		game_start_time_utc: "2023-03-01 10:00:00",
		game_end_time_utc: "2023-03-01 10:18:30",
		game_mode: "Summoner's Rift",
		game_type: "Ranked",
		game_outcome: "Victory",
		player_rank: "Gold III",
		account_level: 120,
		...overrides,
	};
}

describe("wildriftMatches", () => {
	it("試合を正規化する", () => {
		const { result, skipped } = runAdapter(wildriftMatches, [match()]);

		expect(skipped).toBe(0);
		expect(result.matches).toEqual([
			{
				game: "wildrift",
				id: "100000000000000001",
				startedAt: utc("2023-03-01T10:00:00Z"),
				endedAt: utc("2023-03-01T10:18:30Z"),
				durationSec: 1110,
				queue: {
					category: "ranked",
					rawMode: "Summoner's Rift",
					rawType: "Ranked",
				},
				outcome: "win",
				countsForWinRate: true,
				rank: "Gold III",
				accountLevel: 120,
			},
		]);
	});

	it.each([
		["Summoner's Rift", "Ranked", "ranked"],
		["Summoner's Rift", "Normal", "normal"],
		["Summoner's Rift", "AI", "practice"],
		["Summoner's Rift", "Co-op vs. AI", "practice"],
		["Summoner's Rift", "co-op vs. ai", "practice"],
		["Tutorial Basics", "Normal", "practice"],
		["tutorial basics", "Ranked", "practice"],
		["Duel", "Duel", "other"],
		["Summoner's Rift", "Unknown", "other"],
	])("%s / %s を %s に区分する", (mode, type, expected) => {
		const { result } = runAdapter(wildriftMatches, [
			match({ game_mode: mode, game_type: type }),
		]);

		expect(result.matches?.[0]?.queue.category).toBe(expected);
	});

	it.each([
		["Victory", "win"],
		["Defeat", "loss"],
		["Noncompetitive", "none"],
		[null, "none"],
	])("勝敗 %s を %s に読む", (value, expected) => {
		const { result } = runAdapter(wildriftMatches, [
			match({ game_outcome: value }),
		]);

		expect(result.matches?.[0]?.outcome).toBe(expected);
	});

	it("Noncompetitive の試合は勝率に数えない", () => {
		const { result } = runAdapter(wildriftMatches, [
			match({ game_type: "Duel", game_outcome: "Noncompetitive" }),
		]);

		expect(result.matches?.[0]).toMatchObject({
			outcome: "none",
			countsForWinRate: false,
		});
	});

	it("練習の試合は勝敗を保つが、勝率に数えない", () => {
		const { result } = runAdapter(wildriftMatches, [
			match({ game_type: "Co-op vs. AI", game_outcome: "Victory" }),
		]);

		expect(result.matches?.[0]).toMatchObject({
			queue: { category: "practice" },
			outcome: "win",
			countsForWinRate: false,
		});
	});

	it("開始と終了が null の試合も残し、長さを null にする", () => {
		const { result, skipped } = runAdapter(wildriftMatches, [
			match({ game_start_time_utc: null, game_end_time_utc: null }),
		]);

		expect(skipped).toBe(0);
		expect(result.matches?.[0]).toMatchObject({
			startedAt: null,
			endedAt: null,
			durationSec: null,
		});
	});

	it("終了が開始より前のときは、長さを null にする", () => {
		const { result } = runAdapter(wildriftMatches, [
			match({ game_end_time_utc: "2023-03-01 09:00:00" }),
		]);

		expect(result.matches?.[0]?.durationSec).toBeNull();
	});

	it("ID の末尾の枝番を保つ", () => {
		const { result } = runAdapter(wildriftMatches, [
			match({ game_id: "100000000000000001-2" }),
		]);

		expect(result.matches?.[0]?.id).toBe("100000000000000001-2");
	});

	it("ランクとレベルが無いときは null にする", () => {
		const { result } = runAdapter(wildriftMatches, [
			match({ player_rank: null, account_level: "x" }),
			match({ player_rank: "Unknown", account_level: undefined }),
		]);

		expect(result.matches).toMatchObject([
			{ rank: null, accountLevel: null },
			{ rank: null, accountLevel: null },
		]);
	});

	it("ID が無い行と、オブジェクトでない行は飛ばす", () => {
		const { result, skipped } = runAdapter(wildriftMatches, [
			match({ game_id: null }),
			"broken",
			null,
			match(),
		]);

		expect(skipped).toBe(3);
		expect(result.matches).toHaveLength(1);
	});

	it("配列でない入力には空の結果を返す", () => {
		expect(runAdapter(wildriftMatches, { unexpected: true }).result).toEqual({
			matches: [],
		});
		expect(runAdapter(wildriftMatches, null).result).toEqual({ matches: [] });
	});
});

describe("wildriftCurrency", () => {
	it("文字列の残高を通貨ごとに読む", () => {
		const { result, skipped } = runAdapter(wildriftCurrency, {
			blue_motes: "1500",
			poro_coins: "20",
			wild_cores: "300",
		});

		expect(skipped).toBe(0);
		expect(result.balances).toEqual([
			{ game: "wildrift", currency: "Blue Motes", amount: 1500 },
			{ game: "wildrift", currency: "Poro Coins", amount: 20 },
			{ game: "wildrift", currency: "Wild Cores", amount: 300 },
		]);
	});

	it("数値で入っている残高も読む", () => {
		const { result } = runAdapter(wildriftCurrency, { blue_motes: 7 });

		expect(result.balances).toEqual([
			{ game: "wildrift", currency: "Blue Motes", amount: 7 },
		]);
	});

	it.each([
		["小数", "1.5"],
		["文字列", "many"],
		["空文字列", ""],
		["null", null],
		["オブジェクト", {}],
	])("残高が%sのときはその通貨を含めない", (_label, value) => {
		const { result, skipped } = runAdapter(wildriftCurrency, {
			blue_motes: value,
			poro_coins: "5",
		});

		expect(skipped).toBe(0);
		expect(result.balances).toEqual([
			{ game: "wildrift", currency: "Poro Coins", amount: 5 },
		]);
	});

	it("知らない項目は無視する", () => {
		const { result } = runAdapter(wildriftCurrency, { other_coins: "9" });

		expect(result.balances).toEqual([]);
	});

	it.each([
		["配列", []],
		["null", null],
		["文字列", "text"],
	])("オブジェクトでない入力（%s）は飛ばして空の結果を返す", (_label, json) => {
		const { result, skipped } = runAdapter(wildriftCurrency, json);

		expect(skipped).toBe(1);
		expect(result).toEqual({ balances: [] });
	});
});

describe("wildriftInventory", () => {
	it.each([
		["champions", "champion"],
		["emotes", "emote"],
		["summoner_icons", "icon"],
		["icon_borders", "iconBorder"],
		["banners", "banner"],
		["baubles", "bauble"],
	])(
		"%s を %s として読み、名前の前後の空白と改行を取り除く",
		(key, category) => {
			const { result, skipped } = runAdapter(wildriftInventory, {
				[key]: ["Sample One\n", " Sample Two "],
			});

			expect(skipped).toBe(0);
			expect(result.inventory).toEqual([
				{
					game: "wildrift",
					category,
					name: "Sample One",
					detail: null,
					quantity: null,
				},
				{
					game: "wildrift",
					category,
					name: "Sample Two",
					detail: null,
					quantity: null,
				},
			]);
		},
	);

	it("名前が文字列でない、または空の要素は飛ばす", () => {
		const { result, skipped } = runAdapter(wildriftInventory, {
			champions: ["Lux", "", "  \n", null, 5, { name: "Ahri" }],
		});

		expect(skipped).toBe(5);
		expect(result.inventory).toHaveLength(1);
	});

	it("消耗品は数を整数として読む", () => {
		const { result, skipped } = runAdapter(wildriftInventory, {
			backpack: [
				{ name: "Sample Item\n", quantity: 3 },
				{ name: "Sample Item B", quantity: "12" },
				{ name: "Sample Item C", quantity: null },
			],
		});

		expect(skipped).toBe(0);
		expect(result.inventory).toEqual([
			{
				game: "wildrift",
				category: "consumable",
				name: "Sample Item",
				detail: null,
				quantity: 3,
			},
			{
				game: "wildrift",
				category: "consumable",
				name: "Sample Item B",
				detail: null,
				quantity: 12,
			},
			{
				game: "wildrift",
				category: "consumable",
				name: "Sample Item C",
				detail: null,
				quantity: null,
			},
		]);
	});

	it("名前が無い消耗品と、オブジェクトでない要素は飛ばす", () => {
		const { result, skipped } = runAdapter(wildriftInventory, {
			backpack: [{ quantity: 1 }, { name: " ", quantity: 1 }, "x", null],
		});

		expect(skipped).toBe(4);
		expect(result.inventory).toEqual([]);
	});

	it("入れ替わったスキンの項目を、正しい向きに戻す", () => {
		const { result, skipped } = runAdapter(wildriftInventory, {
			skins: [{ champion_name: "Spellthief Lux\n", skin_name: "Lux\n" }],
		});

		expect(skipped).toBe(0);
		expect(result.inventory).toEqual([
			{
				game: "wildrift",
				category: "skin",
				name: "Spellthief Lux",
				detail: "Lux",
				quantity: null,
			},
		]);
	});

	it("正しい向きのスキンの項目は、そのまま読む", () => {
		const { result, skipped } = runAdapter(wildriftInventory, {
			skins: [{ champion_name: "Lux", skin_name: "Spellthief Lux" }],
		});

		expect(skipped).toBe(0);
		expect(result.inventory).toEqual([
			{
				game: "wildrift",
				category: "skin",
				name: "Spellthief Lux",
				detail: "Lux",
				quantity: null,
			},
		]);
	});

	it("名前が互いを含まないスキンは、項目名のとおりに読む", () => {
		const { result } = runAdapter(wildriftInventory, {
			skins: [{ champion_name: "Ahri", skin_name: "Foxfire" }],
		});

		expect(result.inventory).toMatchObject([
			{ category: "skin", name: "Foxfire", detail: "Ahri" },
		]);
	});

	it("2 つの名前が同じスキンは、項目名のとおりに読む", () => {
		const { result } = runAdapter(wildriftInventory, {
			skins: [{ champion_name: "Lux", skin_name: "Lux" }],
		});

		expect(result.inventory).toMatchObject([
			{ category: "skin", name: "Lux", detail: "Lux" },
		]);
	});

	it("スキン名が無いスキンと、オブジェクトでない要素は飛ばす", () => {
		const { result, skipped } = runAdapter(wildriftInventory, {
			skins: [
				{ champion_name: "Lux" },
				{ champion_name: "Lux", skin_name: "" },
				null,
				"broken",
			],
		});

		expect(skipped).toBe(4);
		expect(result.inventory).toEqual([]);
	});

	it("全種類の所持品を 1 つの配列にまとめる", () => {
		const { result, skipped } = runAdapter(wildriftInventory, {
			champions: ["Lux"],
			skins: [{ champion_name: "Spellthief Lux", skin_name: "Lux" }],
			emotes: ["Sample Emote"],
			summoner_icons: ["Sample Icon"],
			icon_borders: ["Sample Border"],
			banners: ["Sample Banner"],
			baubles: ["Sample Bauble"],
			backpack: [{ name: "Sample Item", quantity: 2 }],
			unknown_field: ["ignored"],
		});

		expect(skipped).toBe(0);
		expect(result.inventory?.map((item) => item.category)).toEqual([
			"champion",
			"skin",
			"emote",
			"icon",
			"iconBorder",
			"banner",
			"bauble",
			"consumable",
		]);
	});

	it("配列でない項目は無視する", () => {
		const { result, skipped } = runAdapter(wildriftInventory, {
			champions: "Lux",
			skins: { champion_name: "Lux" },
			backpack: null,
		});

		expect(skipped).toBe(0);
		expect(result.inventory).toEqual([]);
	});

	it.each([
		["配列", []],
		["null", null],
		["文字列", "text"],
	])("オブジェクトでない入力（%s）は飛ばして空の結果を返す", (_label, json) => {
		const { result, skipped } = runAdapter(wildriftInventory, json);

		expect(skipped).toBe(1);
		expect(result).toEqual({ inventory: [] });
	});
});

function purchase(overrides: Record<string, unknown> = {}) {
	return {
		purchase_date: "2023-03-01 10:00:00",
		transaction_type: "Purchase",
		transaction_source: "Store",
		item_type: "Champion",
		item_name: "Sample Champion",
		spent_currency_name: "Blue Motes",
		spent_currency_amount: 450,
		transaction_id: null,
		...overrides,
	};
}

describe("wildriftPurchases", () => {
	it("取引を正規化する", () => {
		const { result, skipped } = runAdapter(wildriftPurchases, [purchase()]);

		expect(skipped).toBe(0);
		expect(result.transactions).toEqual([
			{
				game: "wildrift",
				id: null,
				at: utc("2023-03-01T10:00:00Z"),
				kind: "purchase",
				rawKind: "Purchase",
				source: "Store",
				item: {
					name: "Sample Champion",
					rawId: null,
					category: "Champion",
					quantity: null,
				},
				deltas: [{ currency: "Blue Motes", amount: -450 }],
				balances: [],
				refunded: null,
				ip: null,
			},
		]);
	});

	it.each([
		["Purchase", "purchase"],
		["purchase", "purchase"],
		["Refund", "other"],
		["", "other"],
		[null, "other"],
	])("取引の種類 %s を %s に区分する", (rawType, expected) => {
		const { result } = runAdapter(wildriftPurchases, [
			purchase({ transaction_type: rawType }),
		]);

		expect(result.transactions?.[0]?.kind).toBe(expected);
	});

	it("取引 ID があれば読む", () => {
		const { result } = runAdapter(wildriftPurchases, [
			purchase({ transaction_id: "T-1" }),
		]);

		expect(result.transactions?.[0]?.id).toBe("T-1");
	});

	it("品目名が null の取引も残す", () => {
		const { result, skipped } = runAdapter(wildriftPurchases, [
			purchase({ item_name: null }),
		]);

		expect(skipped).toBe(0);
		expect(result.transactions?.[0]?.item.name).toBeNull();
	});

	it.each([
		["0", 0],
		["null", null],
		["負の値", -1],
		["文字列", "many"],
	])("支払量が%sのときは増減を空にする", (_label, amount) => {
		const { result, skipped } = runAdapter(wildriftPurchases, [
			purchase({ spent_currency_amount: amount }),
		]);

		expect(skipped).toBe(0);
		expect(result.transactions?.[0]?.deltas).toEqual([]);
	});

	it("通貨名が無いときは増減を空にする", () => {
		const { result } = runAdapter(wildriftPurchases, [
			purchase({ spent_currency_name: null }),
		]);

		expect(result.transactions?.[0]?.deltas).toEqual([]);
	});

	it("日時が無い、または読めない行と、オブジェクトでない行は飛ばす", () => {
		const { result, skipped } = runAdapter(wildriftPurchases, [
			purchase({ purchase_date: null }),
			purchase({ purchase_date: "soon" }),
			"broken",
			null,
			purchase(),
		]);

		expect(skipped).toBe(4);
		expect(result.transactions).toHaveLength(1);
	});

	it("配列でない入力には空の結果を返す", () => {
		expect(runAdapter(wildriftPurchases, { unexpected: true }).result).toEqual({
			transactions: [],
		});
		expect(runAdapter(wildriftPurchases, null).result).toEqual({
			transactions: [],
		});
	});
});
