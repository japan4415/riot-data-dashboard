import { describe, expect, it } from "vitest";
import { gameScreens } from "./games.ts";
import { fixedOffset } from "./localTime.ts";
import { ALL_PERIOD } from "./period.ts";
import {
	balanceSeries,
	currencyFlows,
	gifts,
	giftsInPeriod,
	purchasesByCategory,
	skinsByChampion,
	storeSummary,
	transactionsInPeriod,
	transactionsOf,
} from "./store.ts";
import { at, datasetOf, match, transaction } from "./testing.ts";

const jst = fixedOffset(540);

const rp = (amount: number) => ({ currency: "RP", amount });
const be = (amount: number) => ({ currency: "BE", amount });

describe("transactionsOf / transactionsInPeriod", () => {
	const dataset = datasetOf({
		transactions: [
			transaction("2022-01-01T00:00:00Z"),
			transaction("2021-01-01T00:00:00Z"),
			transaction("2021-06-01T00:00:00Z", { game: "valorant" }),
		],
	});

	it("指定したゲームの取引を、古い順に返す", () => {
		const result = transactionsOf(dataset, "lol");
		expect(result.map((item) => item.at)).toEqual([
			at("2021-01-01T00:00:00Z"),
			at("2022-01-01T00:00:00Z"),
		]);
	});

	it("年で絞り込む。年の境目は利用者の時刻で決める", () => {
		const transactions = [
			// UTC では 2021 年の大みそか 16 時、日本時間では 2022 年の元日 1 時
			transaction("2021-12-31T16:00:00Z"),
			transaction("2021-06-01T00:00:00Z"),
		];
		expect(
			transactionsInPeriod(transactions, { kind: "year", year: 2022 }, jst),
		).toHaveLength(1);
		expect(transactionsInPeriod(transactions, ALL_PERIOD, jst)).toHaveLength(2);
	});
});

describe("gameScreens", () => {
	it("記録があるゲームだけを、決まった順に返す", () => {
		const dataset = datasetOf({
			matches: [match("2024-01-01T00:00:00Z", { game: "wildrift" })],
			transactions: [
				transaction("2024-01-01T00:00:00Z", { game: "valorant" }),
				transaction("2024-01-01T00:00:00Z", { game: "lol" }),
			],
		});
		expect(gameScreens(dataset)).toEqual(["lol", "valorant", "wildrift"]);
	});

	it("所持品や残高だけでも、画面を出す", () => {
		const dataset = datasetOf({
			balances: [{ game: "wildrift", currency: "Blue Motes", amount: 1 }],
		});
		expect(gameScreens(dataset)).toEqual(["wildrift"]);
	});

	it("専用の画面が無いゲームと、記録が無いゲームは含めない", () => {
		const dataset = datasetOf({
			transactions: [transaction("2024-01-01T00:00:00Z", { game: "tft" })],
		});
		expect(gameScreens(dataset)).toEqual([]);
	});
});

describe("currencyFlows", () => {
	it("通貨ごとに、支払った量と得た量を合計する", () => {
		const flows = currencyFlows([
			transaction("2024-01-01T00:00:00Z", { deltas: [rp(-975)] }),
			transaction("2024-01-02T00:00:00Z", { deltas: [rp(-25), be(-4800)] }),
			transaction("2024-01-03T00:00:00Z", { deltas: [rp(1000)] }),
			transaction("2024-01-04T00:00:00Z"),
		]);
		expect(flows).toEqual([
			{ currency: "RP", spent: 1000, spentCount: 2, gained: 1000 },
			{ currency: "BE", spent: 4800, spentCount: 1, gained: 0 },
		]);
	});
});

describe("balanceSeries", () => {
	const transactions = [
		transaction("2020-05-01T00:00:00Z", { balances: [rp(500), be(100)] }),
		transaction("2021-02-01T00:00:00Z", { balances: [rp(300), be(100)] }),
		// 同じ時刻の取引は、最後の残高だけを残す
		transaction("2021-03-01T00:00:00Z", { balances: [rp(200)] }),
		transaction("2021-03-01T00:00:00Z", { balances: [rp(100)] }),
		// 残高の記録が無い取引は飛ばす
		transaction("2021-04-01T00:00:00Z"),
		transaction("2022-01-05T00:00:00Z", { balances: [rp(900)] }),
	];

	it("取引後の残高を、古い順に並べる", () => {
		expect(balanceSeries(transactions, "RP", ALL_PERIOD, jst)).toEqual({
			points: [
				{ at: at("2020-05-01T00:00:00Z"), amount: 500 },
				{ at: at("2021-02-01T00:00:00Z"), amount: 300 },
				{ at: at("2021-03-01T00:00:00Z"), amount: 100 },
				{ at: at("2022-01-05T00:00:00Z"), amount: 900 },
			],
			opening: null,
		});
	});

	it("1 年分では、その年の残高と、年が始まる前の最後の残高を返す", () => {
		expect(
			balanceSeries(transactions, "RP", { kind: "year", year: 2021 }, jst),
		).toEqual({
			points: [
				{ at: at("2021-02-01T00:00:00Z"), amount: 300 },
				{ at: at("2021-03-01T00:00:00Z"), amount: 100 },
			],
			opening: 500,
		});
	});

	it("通貨ごとに分けて扱う", () => {
		expect(
			balanceSeries(transactions, "BE", ALL_PERIOD, jst).points,
		).toHaveLength(2);
	});

	it("その年に取引が無くても、前の残高は返す", () => {
		expect(
			balanceSeries(transactions, "RP", { kind: "year", year: 2023 }, jst),
		).toEqual({ points: [], opening: 900 });
	});

	it("前の年の取引にその通貨の残高が無ければ、前の残高は null", () => {
		expect(
			balanceSeries(
				[
					transaction("2020-05-01T00:00:00Z", { balances: [be(100)] }),
					transaction("2021-02-01T00:00:00Z", { balances: [rp(300)] }),
				],
				"RP",
				{ kind: "year", year: 2021 },
				jst,
			),
		).toEqual({
			points: [{ at: at("2021-02-01T00:00:00Z"), amount: 300 }],
			opening: null,
		});
	});

	describe("同じ時刻に記録された取引", () => {
		const row = (amount: number, delta: number) =>
			transaction("2021-03-01T00:00:00Z", {
				balances: [rp(amount)],
				deltas: delta === 0 ? [] : [rp(delta)],
			});
		const before = transaction("2021-02-01T00:00:00Z", {
			balances: [rp(1000)],
		});
		const last = (rows: ReturnType<typeof row>[]) =>
			balanceSeries([before, ...rows], "RP", ALL_PERIOD, jst).points.at(-1)
				?.amount;

		it("元の並びが取引の順でなくても、増減のつながりから最後の残高を決める", () => {
			// 1,000 → 25（購入）→ 1,405（RP の購入）の順に起きたが、逆順に記録されている
			expect(last([row(1405, 1380), row(25, -975)])).toBe(1405);
			expect(last([row(25, -975), row(1405, 1380)])).toBe(1405);
		});

		it("増減が無い行は、順番の手がかりにしない", () => {
			// バンドルの中身の行は増減が無く、購入の前後どちらの残高も持ちうる
			expect(last([row(25, -975), row(1000, 0)])).toBe(25);
			expect(last([row(1000, 0), row(25, -975), row(25, 0)])).toBe(25);
		});

		it("買ってすぐ返金したときは、元の残高に戻る", () => {
			expect(last([row(1000, 975), row(25, -975)])).toBe(1000);
		});

		it("直前の残高が分からなくても、つながりの終点を採る", () => {
			const rows = [row(1405, 1380), row(25, -975)];
			expect(
				balanceSeries(rows, "RP", ALL_PERIOD, jst).points.at(-1)?.amount,
			).toBe(1405);
		});

		it("つながりをたどれないときは、元の並びで最後の行の残高を使う", () => {
			// 1,000 から始まる行が無く、2 行の間もつながらない
			expect(last([row(500, -100), row(200, -50)])).toBe(200);
		});

		it("増減のある行が無ければ、元の並びで最後の行の残高を使う", () => {
			expect(last([row(1000, 0), row(1000, 0)])).toBe(1000);
		});
	});
});

describe("purchasesByCategory / storeSummary", () => {
	const transactions = [
		transaction("2024-01-01T00:00:00Z", {
			category: "skin",
			deltas: [rp(-975)],
		}),
		transaction("2024-01-02T00:00:00Z", { category: "skin" }),
		transaction("2024-01-03T00:00:00Z", {
			category: "champion",
			deltas: [be(-4800)],
		}),
		transaction("2024-01-04T00:00:00Z", { category: null }),
		transaction("2024-01-05T00:00:00Z", {
			kind: "topUp",
			category: "rp",
			deltas: [rp(1000)],
		}),
		transaction("2024-01-06T00:00:00Z", {
			kind: "giftSent",
			category: "skin",
			deltas: [rp(-500)],
		}),
		transaction("2024-01-07T00:00:00Z", { kind: "refund", deltas: [rp(975)] }),
	];

	it("購入した品目を、区分と支払い方で数える", () => {
		expect(purchasesByCategory(transactions)).toEqual([
			{ category: "skin", counts: { rp: 1, be: 0, none: 1 }, total: 2 },
			{ category: null, counts: { rp: 0, be: 0, none: 1 }, total: 1 },
			{ category: "champion", counts: { rp: 0, be: 1, none: 0 }, total: 1 },
		]);
	});

	it("取引の数、購入の数、通貨の出入りをまとめる", () => {
		expect(storeSummary(transactions)).toEqual({
			transactions: 7,
			purchases: 4,
			topUps: 1,
			toppedUpRp: 1000,
			// 品目の購入と贈り物の支払い。返金で戻った分は差し引かない
			spentRp: 1475,
			spentBe: 4800,
		});
	});
});

describe("skinsByChampion", () => {
	const skin = (id: number, options: Parameters<typeof transaction>[1] = {}) =>
		transaction("2024-01-01T00:00:00Z", {
			rawId: `championsskin_${id}`,
			category: "skin",
			...options,
		});

	it("スキンの ID からチャンピオンを求め、多い順に並べる", () => {
		expect(
			skinsByChampion([
				skin(103001),
				skin(1001),
				skin(1002),
				// 色違いも 1 つと数える
				skin(1014),
			]),
		).toEqual([
			{ championId: 1, count: 3 },
			{ championId: 103, count: 1 },
		]);
	});

	it("同じ数なら、チャンピオンの ID が小さい順に並べる", () => {
		expect(
			skinsByChampion([skin(103001), skin(1001)]).map(
				(entry) => entry.championId,
			),
		).toEqual([1, 103]);
	});

	it("贈り物、返金済み、スキン以外の品目は数えない", () => {
		const refunded = { ...skin(1003), refunded: true };
		expect(
			skinsByChampion([
				skin(1001),
				skin(1002, { kind: "giftSent" }),
				refunded,
				transaction("2024-01-01T00:00:00Z", { rawId: "champions_1" }),
				transaction("2024-01-01T00:00:00Z", { rawId: "championsskin_abc" }),
				transaction("2024-01-01T00:00:00Z", { rawId: null }),
				// チャンピオンの ID を求められない、小さすぎる値
				skin(12),
			]),
		).toEqual([{ championId: 1, count: 1 }]);
	});

	it("購入が無ければ空", () => {
		expect(skinsByChampion([])).toEqual([]);
	});
});

describe("gifts", () => {
	it("支払いの行と品目を移す行を、1 件の贈り物にまとめる", () => {
		const result = gifts([
			transaction("2024-01-01T00:00:00Z", {
				kind: "giftSent",
				rawKind: "PURCHASED_GIFT",
				rawId: "championsskin_1001",
				category: "skin",
				deltas: [rp(-975)],
			}),
			transaction("2024-01-01T00:00:01Z", {
				kind: "giftSent",
				rawKind: "ITEM_TRANSFER_SENT",
				rawId: "championsskin_1001",
				category: "skin",
			}),
		]);
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			at: at("2024-01-01T00:00:01Z"),
			direction: "sent",
			what: "item",
			mystery: false,
			deltas: [rp(-975)],
			item: { rawId: "championsskin_1001", category: "skin" },
		});
	});

	it("品目が違う行や、時刻が離れた行は組にしない", () => {
		const result = gifts([
			transaction("2024-01-01T00:00:00Z", {
				rawKind: "PURCHASED_MYSTERY_GIFT",
				rawId: "championsskin_1001",
				deltas: [rp(-490)],
			}),
			transaction("2024-01-01T00:00:01Z", {
				rawKind: "ITEM_TRANSFER_SENT",
				rawId: "championsskin_2002",
			}),
			transaction("2024-01-01T01:00:00Z", {
				rawKind: "ITEM_TRANSFER_SENT",
				rawId: "championsskin_1001",
			}),
		]);
		expect(result).toHaveLength(3);
		expect(result.filter((gift) => gift.mystery)).toHaveLength(1);
	});

	it("同じ品目を続けて贈ったときは、1 行ずつ組にする", () => {
		const row = (rawKind: string, seconds: number) =>
			transaction(`2024-01-01T00:00:0${seconds}Z`, {
				rawKind,
				rawId: "summoner_icon_1",
				deltas: rawKind === "PURCHASED_GIFT" ? [rp(-250)] : [],
			});
		const result = gifts([
			row("PURCHASED_GIFT", 0),
			row("ITEM_TRANSFER_SENT", 0),
			row("PURCHASED_GIFT", 2),
			row("ITEM_TRANSFER_SENT", 2),
		]);
		expect(result).toHaveLength(2);
		expect(result.every((gift) => gift.deltas[0]?.amount === -250)).toBe(true);
	});

	it("品目 ID が無い行どうしは、組にしない", () => {
		const result = gifts([
			transaction("2024-01-01T00:00:00Z", {
				rawKind: "PURCHASED_GIFT",
				deltas: [rp(-975)],
			}),
			transaction("2024-01-01T00:00:01Z", { rawKind: "ITEM_TRANSFER_SENT" }),
		]);
		expect(result).toHaveLength(2);
	});

	it("年をまたいで記録された 2 行も、1 件の贈り物として数える", () => {
		// 日本時間では、支払いが大みそかの 23:59:58、品目の移動が元日の 0:00:02
		const transactions = [
			transaction("2023-12-31T14:59:58Z", {
				rawKind: "PURCHASED_GIFT",
				rawId: "championsskin_1001",
				deltas: [rp(-975)],
			}),
			transaction("2023-12-31T15:00:02Z", {
				rawKind: "ITEM_TRANSFER_SENT",
				rawId: "championsskin_1001",
			}),
		];
		expect(
			giftsInPeriod(transactions, { kind: "year", year: 2023 }, jst),
		).toEqual([]);
		const inNewYear = giftsInPeriod(
			transactions,
			{ kind: "year", year: 2024 },
			jst,
		);
		expect(inNewYear).toHaveLength(1);
		expect(inNewYear[0]?.deltas).toEqual([rp(-975)]);
		expect(giftsInPeriod(transactions, ALL_PERIOD, jst)).toHaveLength(1);
	});

	it("RP の贈り物と、受け取った贈り物を区別する", () => {
		const result = gifts([
			transaction("2024-01-01T00:00:00Z", {
				rawKind: "RP_TRANSFER_SENT",
				deltas: [rp(-500)],
			}),
			transaction("2024-01-02T00:00:00Z", {
				rawKind: "RP_TRANSFER_RECEIVED",
				deltas: [rp(650)],
			}),
			transaction("2024-01-03T00:00:00Z", {
				rawKind: "ITEM_TRANSFER_RECEIVED",
				rawId: "champions_1",
			}),
			// 贈り物ではない取引
			transaction("2024-01-04T00:00:00Z", { rawKind: "PURCHASE" }),
		]);
		// 新しい順
		expect(
			result.map((gift) => [gift.direction, gift.what, gift.deltas]),
		).toEqual([
			["received", "item", []],
			["received", "rp", [rp(650)]],
			["sent", "rp", [rp(-500)]],
		]);
	});
});
