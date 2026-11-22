// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { syntheticExportFiles } from "../../tests/fixtures/syntheticExport.ts";
import {
	importSynthetic,
	menu,
	openScreen,
	openScreenAndWait,
	showTable,
	statNote,
	statValue,
	tableRows,
} from "./testing.tsx";

afterEach(() => {
	cleanup();
	window.history.replaceState(null, "", "/");
});

function choosePeriod(year: string) {
	fireEvent.change(screen.getByLabelText("期間"), { target: { value: year } });
}

function headings(level: number): Array<string | null> {
	return screen
		.getAllByRole("heading", { level })
		.map((heading) => heading.textContent);
}

/** 指定したフォルダのファイルを、合成データからすべて取り除くための一覧。 */
function filesUnder(folder: string): string[] {
	return Object.keys(syntheticExportFiles()).filter((path) =>
		path.toLowerCase().startsWith(`${folder}/`),
	);
}

describe("メニュー", () => {
	it("記録があるゲームの画面を、決まった順に並べる", async () => {
		await importSynthetic();

		const links = within(menu())
			.getAllByRole("link")
			.map((link) => link.textContent);
		expect(links).toEqual([
			"概要",
			"活動",
			"League of Legends",
			"VALORANT",
			"Legends of Runeterra",
			"Wild Rift",
			"課金",
			"アカウント",
			"読み込み結果",
		]);
		expect(within(menu()).getByRole("list", { name: "ゲーム" })).toBeDefined();
	});

	it("記録が無いゲームは、メニューに出さない", async () => {
		await importSynthetic({ omit: filesUnder("wildrift") });

		expect(
			within(menu()).queryByRole("link", { name: "Wild Rift" }),
		).toBeNull();
		expect(
			within(menu()).getByRole("link", { name: "VALORANT" }),
		).toBeDefined();
	});

	it("記録が無いゲームのパスを開いていても、概要へ移る", async () => {
		window.history.replaceState(null, "", "/wildrift");

		await importSynthetic({ omit: filesUnder("wildrift") });

		expect(window.location.pathname).toBe("/");
	});
});

describe("概要からの移動", () => {
	it("ゲームごとの記録から、そのゲームの画面へ移れる", async () => {
		await importSynthetic();

		fireEvent.click(
			screen.getByRole("link", { name: "Wild Rift をくわしく見る" }),
		);

		expect(
			screen.getByRole("heading", { level: 1, name: "Wild Rift" }),
		).toBeDefined();
		expect(window.location.pathname).toBe("/wildrift");
	});

	it("試合履歴が無い LoL には、ストアの取引への案内を出す", async () => {
		await importSynthetic();

		fireEvent.click(
			screen.getByRole("link", {
				name: "League of Legends のストアの取引を見る",
			}),
		);

		expect(window.location.pathname).toBe("/lol");
		// この画面は、開いたときにコードを読み込む
		const heading = await screen.findByRole("heading", {
			level: 1,
			name: "League of Legends",
		});
		expect(document.activeElement).toBe(heading);
	});

	it("ログインの記録だけがあるゲームには、案内を出さない", async () => {
		await importSynthetic({
			omit: filesUnder("wildrift"),
			extra: {
				"riotAccount/atlas_login_event_uc.json": [
					{
						event_time_utc: "2021-05-01 09:55:00",
						event_type: "Login",
						ip_address: "203.0.113.9",
						product: "Wild Rift",
					},
				],
			},
		});

		expect(
			screen.getByRole("heading", { level: 3, name: "Wild Rift" }),
		).toBeDefined();
		expect(
			screen.queryByRole("link", { name: "Wild Rift をくわしく見る" }),
		).toBeNull();
	});
});

describe("VALORANT の画面", () => {
	it("メニューから移り、見出しにフォーカスを移す", async () => {
		await importSynthetic();
		openScreen("VALORANT");

		const heading = screen.getByRole("heading", { level: 1, name: "VALORANT" });
		expect(document.activeElement).toBe(heading);
		expect(window.location.pathname).toBe("/valorant");
		expect(document.title).toBe("VALORANT | Riot データダッシュボード");
	});

	it("練習を除いた試合数、勝率、プレイ時間を表示する", async () => {
		await importSynthetic();
		openScreen("VALORANT");

		expect(statValue("試合数")).toBe("2 試合");
		expect(statNote("試合数")).toBe("ほかに練習 1 回");
		expect(statValue("勝率")).toBe("50.0%");
		expect(statNote("勝率")).toBe("1 勝 1 敗");
		expect(statValue("プレイ時間")).toBe("1 時間");
		// 20 分と 35.5 分の中央値
		expect(statValue("1 試合の長さ")).toBe("28 分");
	});

	it("図表と一覧を、決まった順に並べる", async () => {
		await importSynthetic();
		openScreen("VALORANT");

		expect(headings(2)).toEqual([
			"年ごとの試合数",
			"種別ごとの勝敗",
			"購入の一覧",
		]);
	});

	it("年ごとの試合数には、練習を含めない", async () => {
		await importSynthetic();
		openScreen("VALORANT");

		const card = showTable("年ごとの試合数");
		expect(
			within(card)
				.getAllByRole("columnheader")
				.map((cell) => cell.textContent),
		).toEqual(["年", "ランク", "その他の対戦"]);
		expect(tableRows(card)).toEqual([
			["2023年", "0", "1"],
			["2024年", "1", "0"],
		]);
	});

	it("種別ごとの勝敗では、内部のコード名を表示名に直し、元の値を添える", async () => {
		await importSynthetic();
		openScreen("VALORANT");

		const chart = screen.getByRole("list", { name: "種別ごとの試合数と勝敗" });
		const items = within(chart).getAllByRole("listitem");
		expect(items[1]?.textContent).toContain("Team Deathmatch");
		expect(items[1]?.textContent).toContain("元の値は Hurm");

		const card = showTable("種別ごとの勝敗");
		expect(tableRows(card)).toEqual([
			["Ranked", "ランク", "1", "1", "0", "100.0%", "36 分"],
			[
				"Team Deathmatch（Hurm）",
				"その他の対戦",
				"1",
				"0",
				"1",
				"0.0%",
				"20 分",
			],
			["ShootingRange", "練習", "1", "—", "—", "—", "10 分"],
		]);
	});

	it("購入の一覧に、品目と支払った通貨を表示する", async () => {
		await importSynthetic();
		openScreen("VALORANT");

		const card = screen.getByRole("region", { name: "購入の一覧" });
		expect(tableRows(card)).toEqual([
			[
				"2024年2月1日 9:01",
				"Sample Vandal Level 2 (Variant 1 Red)",
				"Item",
				"10 Radianite Points",
			],
		]);
		expect(card.textContent).toContain("Radianite Points10（1 件）");
		expect(card.textContent).toContain("全 1 件");
	});

	it("月ごとの表示に切り替わり、記録が無い年ではその旨を表示する", async () => {
		await importSynthetic();
		openScreen("VALORANT");

		choosePeriod("2024");
		expect(headings(2)[0]).toBe("月ごとの試合数");
		expect(statValue("試合数")).toBe("1 試合");

		choosePeriod("2022");
		expect(
			screen.getByText("2022 年に、VALORANT の記録はありません。"),
		).toBeDefined();
	});
});

describe("Legends of Runeterra の画面", () => {
	it("主要な数値に、決着までのターン数を加える", async () => {
		await importSynthetic();
		openScreen("Legends of Runeterra");

		expect(statValue("試合数")).toBe("1 試合");
		expect(statNote("試合数")).toBe("ほかに練習 1 回");
		expect(statValue("勝率")).toBe("100.0%");
		expect(statValue("決着までのターン数")).toBe("20 ターン");
	});

	it("地域、ターン数、決着の理由の図表を表示する", async () => {
		await importSynthetic();
		openScreen("Legends of Runeterra");

		expect(headings(2)).toEqual([
			"年ごとの試合数",
			"種別ごとの勝敗",
			"デッキの地域",
			"ターン数の分布",
			"決着の理由",
			"購入の一覧",
		]);

		expect(tableRows(showTable("デッキの地域"))).toEqual([
			["Demacia", "1", "1", "0", "100.0%"],
		]);
		expect(tableRows(showTable("ターン数の分布")).at(-1)).toEqual([
			"20〜24 ターン",
			"1",
			"0",
		]);
		expect(tableRows(showTable("決着の理由"))).toEqual([
			["Concession", "1", "1", "0", "100.0%"],
		]);
	});

	it("決着の理由には、日本語の補足を添える", async () => {
		await importSynthetic();
		openScreen("Legends of Runeterra");

		const chart = screen.getByRole("list", {
			name: "決着の理由ごとの試合数と勝敗",
		});
		expect(chart.textContent).toContain("Concession");
		expect(chart.textContent).toContain("降参");
	});

	it("購入の一覧に、手に入れた数を表示する", async () => {
		await importSynthetic();
		openScreen("Legends of Runeterra");

		const card = screen.getByRole("region", { name: "購入の一覧" });
		expect(tableRows(card)).toEqual([
			["2020年2月1日 9:01", "Sample Card", "Card", "1", "100 Coins"],
		]);
	});
});

describe("Wild Rift の画面", () => {
	it("主要な数値に、最高ランクを加える", async () => {
		await importSynthetic();
		openScreen("Wild Rift");

		expect(statValue("試合数")).toBe("1 試合");
		expect(statValue("最高ランク")).toBe("Gold III");
		expect(statNote("最高ランク")).toBe("2021年5月1日に到達");
	});

	it("ランクの推移を、試合の順に並べる", async () => {
		await importSynthetic();
		openScreen("Wild Rift");

		expect(tableRows(showTable("ランクの推移"))).toEqual([
			["1 試合目", "2021年5月1日", "Gold III", "勝ち"],
		]);
	});

	it("所持品を分類で絞り込める", async () => {
		await importSynthetic();
		openScreen("Wild Rift");

		const card = screen.getByRole("region", { name: "所持品の一覧" });
		expect(card.textContent).toContain("全 8 件");
		// 入れ替わって記録されているスキン名とチャンピオン名を、正しい向きで表示する
		expect(tableRows(card)).toContainEqual([
			"Spellthief Lux",
			"スキン",
			"Lux",
			"—",
		]);

		fireEvent.change(within(card).getByLabelText("分類"), {
			target: { value: "consumable" },
		});
		expect(tableRows(card)).toEqual([["XP Boost", "消耗品", "—", "2"]]);
		expect(card.textContent).toContain("全 1 件");
	});

	it("通貨の残高を表示する", async () => {
		await importSynthetic();
		openScreen("Wild Rift");

		const card = screen.getByRole("region", { name: "所持品の一覧" });
		expect(card.textContent).toContain("Blue Motes1,200");
		expect(card.textContent).toContain("Poro Coins30");
	});

	it("試合が無い年でも、所持品は表示する", async () => {
		await importSynthetic();
		openScreen("Wild Rift");

		choosePeriod("2024");

		expect(screen.queryByRole("region", { name: "ランクの推移" })).toBeNull();
		expect(screen.getByRole("region", { name: "所持品の一覧" })).toBeDefined();
	});
});

/** LoL のストアの取引 1 行分。 */
function storeRow(index: number, fields: Record<string, unknown>) {
	return {
		created: `2024-01-01 00:00:${String(index % 60).padStart(2, "0")}`,
		id: `JP1-00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
		ip_address: "203.0.113.8",
		ip_balance: 0,
		ip_delta: 0,
		is_refunded: "0",
		item_id: "summoner_icon_1",
		rp_balance: 0,
		rp_delta: 0,
		type: "PURCHASE",
		...fields,
	};
}

const STORE_PATH = "leagueoflegends/store_transactions_uc.json";

describe("League of Legends の画面", () => {
	it("購入した品目と、通貨の出入りを表示する", async () => {
		await importSynthetic();
		await openScreenAndWait("League of Legends");

		expect(
			screen.getByRole("heading", { level: 1, name: "League of Legends" }),
		).toBeDefined();
		expect(statValue("購入した品目")).toBe("2 件");
		expect(statNote("購入した品目")).toBe("取引の記録は全部で 3 件");
		expect(statValue("購入した RP")).toBe("1,000 RP");
		expect(statNote("購入した RP")).toBe("1 回");
		expect(statValue("使った RP")).toBe("975 RP");
		expect(statValue("使ったブルーエッセンス")).toBe("4,800 BE");
	});

	it("残高、区分、取引の図表と一覧を表示する。贈り物が無ければ一覧を出さない", async () => {
		await importSynthetic();
		await openScreenAndWait("League of Legends");

		expect(headings(2)).toEqual([
			"RP の残高",
			"ブルーエッセンスの残高",
			"購入した品目の区分",
			"スキンが多いチャンピオン",
			"取引の一覧",
		]);
	});

	it("残高の推移を、古い順の表で確かめられる", async () => {
		await importSynthetic();
		await openScreenAndWait("League of Legends");

		expect(tableRows(showTable("RP の残高"))).toEqual([
			["2013年3月4日 14:06", "0"],
			["2021年2月3日 13:05", "1,000"],
			["2022年3月4日 14:06", "25"],
		]);
	});

	it("購入した品目を、区分と支払い方で数える", async () => {
		await importSynthetic();
		await openScreenAndWait("League of Legends");

		const card = showTable("購入した品目の区分");
		// 1 件も無い支払い方の列も、表には出す
		expect(
			within(card)
				.getAllByRole("columnheader")
				.map((cell) => cell.textContent),
		).toEqual([
			"区分",
			"RP で購入",
			"ブルーエッセンスで購入",
			"通貨の増減なし",
			"合計",
		]);
		expect(tableRows(card)).toEqual([
			["チャンピオン", "0", "1", "0", "1"],
			["スキン", "1", "0", "0", "1"],
		]);
	});

	it("取引を新しい順に並べ、種類で絞り込める", async () => {
		await importSynthetic();
		await openScreenAndWait("League of Legends");

		const card = screen.getByRole("region", { name: "取引の一覧" });
		expect(tableRows(card)[0]).toEqual([
			"2022年3月4日 14:06",
			"購入",
			"スキン",
			// チャンピオンとスキンは、品目 ID を名前に直す
			"ゴス アニー",
			"−975",
			"—",
			"25",
			"5,000",
		]);

		fireEvent.change(within(card).getByLabelText("種類"), {
			target: { value: "topUp" },
		});
		expect(tableRows(card)).toHaveLength(1);
		expect(tableRows(card)[0]?.slice(1, 5)).toEqual([
			"通貨の購入",
			"RP",
			"rp_1000",
			"+1,000",
		]);
	});

	it("返金済みの取引には、種類の欄にその旨を添える", async () => {
		await importSynthetic({
			extra: {
				[STORE_PATH]: [
					storeRow(1, { rp_delta: -975, is_refunded: "1" }),
					storeRow(2, { type: "REFUND", rp_delta: 975 }),
				],
			},
		});
		await openScreenAndWait("League of Legends");

		const card = screen.getByRole("region", { name: "取引の一覧" });
		expect(tableRows(card).map((row) => row[1])).toEqual([
			"返金",
			"購入（返金済み）",
		]);
	});

	it("スキンを手に入れた数を、チャンピオンの名前で数える", async () => {
		await importSynthetic({
			extra: {
				[STORE_PATH]: [
					storeRow(1, { item_id: "championsskin_1001", rp_delta: -975 }),
					storeRow(2, { item_id: "championsskin_1002" }),
					storeRow(3, { item_id: "championsskin_103001", rp_delta: -975 }),
					// 対応表に無いチャンピオンは、ID で示す
					storeRow(4, { item_id: "championsskin_999999001" }),
					// 贈り物として受け取ったものは数える
					storeRow(8, {
						type: "ITEM_TRANSFER_RECEIVED",
						item_id: "championsskin_103004",
					}),
					// 人に贈ったものと、返金済みのものは数えない
					storeRow(5, {
						type: "PURCHASED_GIFT",
						item_id: "championsskin_103002",
						rp_delta: -975,
					}),
					storeRow(6, { item_id: "championsskin_103003", is_refunded: "1" }),
					// スキン以外の品目は数えない
					storeRow(7, { item_id: "champions_1" }),
				],
			},
		});
		await openScreenAndWait("League of Legends");

		expect(tableRows(showTable("スキンが多いチャンピオン"))).toEqual([
			["アニー", "2"],
			["アーリ", "2"],
			["チャンピオン 999999", "1"],
		]);
	});

	it("名前が分からない品目は、品目 ID のまま表示し、出どころのバージョンを示す", async () => {
		await importSynthetic();
		await openScreenAndWait("League of Legends");

		const rows = tableRows(screen.getByRole("region", { name: "取引の一覧" }));
		expect(rows.map((row) => row[3])).toEqual([
			"ゴス アニー",
			"rp_1000",
			"アニー",
		]);
		expect(document.body.textContent).toMatch(
			/Riot Games が公開しているゲームデータ（バージョン \d+\.\d+\.\d+\s*）/,
		);
	});

	it("行が多い一覧は、ページに分けて表示する", async () => {
		await importSynthetic({
			extra: {
				[STORE_PATH]: Array.from({ length: 60 }, (_, index) =>
					storeRow(index, {}),
				),
			},
		});
		await openScreenAndWait("League of Legends");

		const card = screen.getByRole("region", { name: "取引の一覧" });
		expect(card.textContent).toContain("1〜50 件目（全 60 件）");
		expect(tableRows(card)).toHaveLength(50);
		expect(
			within(card).getByRole("button", { name: "前のページ" }),
		).toHaveProperty("disabled", true);

		fireEvent.click(within(card).getByRole("button", { name: "次のページ" }));
		expect(card.textContent).toContain("51〜60 件目（全 60 件）");
		expect(tableRows(card)).toHaveLength(10);
		expect(
			within(card).getByRole("button", { name: "次のページ" }),
		).toHaveProperty("disabled", true);
	});

	it("贈り物は、支払いの行と品目を移す行を 1 件にまとめて表示する", async () => {
		await importSynthetic({
			extra: {
				[STORE_PATH]: [
					storeRow(1, {
						type: "PURCHASED_GIFT",
						item_id: "championsskin_1001",
						rp_delta: -975,
					}),
					storeRow(1, {
						type: "ITEM_TRANSFER_SENT",
						item_id: "championsskin_1001",
					}),
					storeRow(30, { type: "RP_TRANSFER_RECEIVED", rp_delta: 650 }),
				],
			},
		});
		await openScreenAndWait("League of Legends");

		const card = screen.getByRole("region", { name: "贈り物の一覧" });
		expect(card.textContent).toContain("贈った1 件");
		expect(card.textContent).toContain("受け取った1 件");
		expect(tableRows(card)).toEqual([
			["2024年1月1日 9:00", "受け取った", "RP", "—", "+650 RP", "—"],
			["2024年1月1日 9:00", "贈った", "スキン", "ゴス アニー", "−975 RP", "—"],
		]);
		// 贈り物の支払いは、購入した品目に数えない
		expect(statValue("購入した品目")).toBe("0 件");
		expect(statValue("使った RP")).toBe("975 RP");
	});
});
