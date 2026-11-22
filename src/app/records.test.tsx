// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
	buildSyntheticZip,
	syntheticExportFiles,
} from "../../tests/fixtures/syntheticExport.ts";
import {
	choose,
	importSynthetic,
	menu,
	openScreen,
	showTable,
	statNote,
	statValue,
	tableRows,
	zipFile,
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

function card(name: string): HTMLElement {
	return screen.getByRole("region", { name });
}

/** 登録情報の枠から、名前に対応する値の要素を返す。 */
function profileValue(label: string): HTMLElement {
	const term = within(card("登録情報"))
		.getAllByRole("term")
		.find((element) => element.textContent === label);
	const value = term?.nextElementSibling;
	if (!(value instanceof HTMLElement)) {
		throw new Error(`登録情報に ${label} がありません`);
	}
	return value;
}

function toggleMask() {
	fireEvent.click(screen.getByRole("button", { name: "伏せ字" }));
}

/**
 * 画面の要素のどこにも（文字にも、属性にも）、その文字列が無いことを確かめる。
 * 伏せている値は、見た目を隠すのではなく、要素そのものに入れない決まりである。
 */
function expectAbsent(...secrets: string[]) {
	const html = document.body.innerHTML;
	for (const secret of secrets) {
		expect(html).not.toContain(secret);
	}
}

const LOGIN_PATH = "riotAccount/atlas_login_event_uc.json";

const PAYMENT_FILES = Object.keys(syntheticExportFiles()).filter((path) =>
	/payment|rp_purchase/.test(path),
);

describe("課金の画面", () => {
	it("メニューの「記録」から移る", async () => {
		await importSynthetic();

		expect(
			within(within(menu()).getByRole("list", { name: "記録" }))
				.getAllByRole("link")
				.map((link) => link.textContent),
		).toEqual(["課金", "アカウント"]);

		openScreen("課金");
		const heading = screen.getByRole("heading", { level: 1, name: "課金" });
		expect(document.activeElement).toBe(heading);
		expect(window.location.pathname).toBe("/spending");
	});

	it("通貨ごとの合計と、支払いの回数を表示する", async () => {
		await importSynthetic();
		openScreen("課金");

		expect(statValue("課金額（JPY）")).toContain("3,100");
		expect(statNote("課金額（JPY）")).toBe("3 回");
		expect(statValue("課金額（USD）")).toContain("12.00");
		expect(statValue("支払いの回数")).toBe("4 回");
	});

	it("通貨ごとに、年ごとの図と累計の図を分けて並べる", async () => {
		await importSynthetic();
		openScreen("課金");

		expect(headings(2)).toEqual([
			"年ごとの課金額（JPY）",
			"累計の課金額（JPY）",
			"年ごとの課金額（USD）",
			"累計の課金額（USD）",
			"支払いの一覧",
		]);
	});

	it("年ごとの課金額を、ゲームごとに分けて確かめられる", async () => {
		await importSynthetic();
		openScreen("課金");

		const table = showTable("年ごとの課金額（JPY）");
		expect(
			within(table)
				.getAllByRole("columnheader")
				.map((cell) => cell.textContent),
		).toEqual([
			"年",
			"League of Legends",
			"VALORANT",
			"Legends of Runeterra",
			"合計",
		]);
		const rows = tableRows(table);
		expect(rows.map((row) => row[0])).toEqual([
			"2020年",
			"2021年",
			"2022年",
			"2023年",
			"2024年",
		]);
		expect(rows[1]?.[1]).toContain("1,300");
		expect(rows[4]?.[2]).toContain("1,200");
		expect(rows[4]?.[4]).toContain("1,200");
	});

	it("累計は、支払いのたびに増える", async () => {
		await importSynthetic();
		openScreen("課金");

		const rows = tableRows(showTable("累計の課金額（JPY）"));
		expect(rows.map((row) => row[1]?.replace(/[^\d,]/g, ""))).toEqual([
			"600",
			"1,900",
			"3,100",
		]);
	});

	it("支払いを新しい順に並べ、ゲームで絞り込める", async () => {
		await importSynthetic();
		openScreen("課金");

		const list = card("支払いの一覧");
		const rows = tableRows(list);
		expect(rows).toHaveLength(4);
		expect(rows[0]?.slice(0, 2)).toEqual(["2024年2月1日 9:00", "VALORANT"]);
		expect(rows[0]?.[3]).toBe("paypal");
		expect(rows[0]?.[4]).toBe("1,000 VP");
		// LoL の支払いには、付与された RP の記録が無い
		expect(rows.at(-1)?.[4]).toBe("—");

		fireEvent.change(within(list).getByLabelText("ゲーム"), {
			target: { value: "lol" },
		});
		expect(tableRows(list).map((row) => row[1])).toEqual([
			"League of Legends",
			"League of Legends",
		]);
	});

	it("一覧の要約に、ゲームと通貨ごとの合計を示す", async () => {
		await importSynthetic();
		openScreen("課金");

		const list = card("支払いの一覧");
		expect(list.textContent).toContain("League of Legends（USD）");
		expect(list.textContent).toContain("VALORANT（JPY）");
		expect(list.textContent).toContain("（1 回）");
	});

	it("1 年分では月ごとに区切り、それまでの累計も示す", async () => {
		await importSynthetic();
		openScreen("課金");
		choosePeriod("2024");

		expect(statValue("課金額（JPY）")).toContain("1,200");
		expect(statValue("課金額（USD）")).toBeNull();
		expect(headings(2)).toEqual([
			"月ごとの課金額（JPY）",
			"累計の課金額（JPY）",
			"累計の課金額（USD）",
			"支払いの一覧",
		]);
		expect(card("累計の課金額（JPY）").textContent).toContain(
			"2024 年より前の分を含みます",
		);
	});

	it("決済の取引番号と IP アドレスは、どこにも出さない", async () => {
		await importSynthetic();
		openScreen("課金");

		expectAbsent(
			// 取引 ID、決済側の取引番号、購入 ID
			"NA1-00000000",
			"T0001",
			"AB1CDE2FGHIJ",
			// IP アドレス
			"203.0.113",
		);
	});

	it("絞り込んでいたゲームの支払いが無い年を挟むと、絞り込みは外れたままになる", async () => {
		await importSynthetic();
		openScreen("課金");
		fireEvent.change(within(card("支払いの一覧")).getByLabelText("ゲーム"), {
			target: { value: "valorant" },
		});
		expect(tableRows(card("支払いの一覧"))).toHaveLength(1);

		// 2021 年は LoL の支払いだけ
		choosePeriod("2021");
		choosePeriod("all");

		expect(tableRows(card("支払いの一覧"))).toHaveLength(4);
	});

	it("支払いが無い年では、その旨を表示する", async () => {
		await importSynthetic();
		openScreen("課金");
		choosePeriod("2022");

		expect(
			screen.getByText("2022 年に、支払いの記録はありません。"),
		).toBeDefined();
		expect(screen.queryByRole("region", { name: "支払いの一覧" })).toBeNull();
	});

	it("支払いの記録が 1 件も無ければ、その旨だけを表示する", async () => {
		await importSynthetic({ omit: PAYMENT_FILES });
		openScreen("課金");

		expect(screen.getByText("支払いの記録がありません。")).toBeDefined();
		expect(screen.queryAllByRole("heading", { level: 2 })).toEqual([]);
	});
});

describe("アカウントの画面", () => {
	it("記録の種類ごとに枠を並べる", async () => {
		await importSynthetic();
		openScreen("アカウント");

		expect(window.location.pathname).toBe("/account");
		expect(headings(2)).toEqual([
			"登録情報",
			"アカウントの変更履歴",
			"ペナルティ",
			"通報の件数",
			"問い合わせ",
			"チャットログ",
			"IP アドレスの一覧",
		]);
	});

	it("メールアドレス、生年月日、電話番号は、初めは伏せておく", async () => {
		await importSynthetic();
		openScreen("アカウント");

		expect(profileValue("Riot ID").textContent).toBe("Tester#JP1");
		expect(profileValue("ユーザー名").textContent).toBe("tester");
		expect(profileValue("LoL のプラットフォーム").textContent).toBe("JP1");
		for (const label of ["メールアドレス", "生年月日", "電話番号"]) {
			expect(profileValue(label).textContent).toContain("伏せ字にしています");
		}
		// 伏せている間は、値そのものを画面の中に置かない
		expectAbsent("player@example.com", "2000年1月2日", "2000-01-02", "+81");
	});

	it("押すと表示し、もう一度押すと隠す", async () => {
		await importSynthetic();
		openScreen("アカウント");

		fireEvent.click(
			screen.getByRole("button", { name: "メールアドレスを表示" }),
		);
		expect(profileValue("メールアドレス").textContent).toContain(
			"player@example.com",
		);
		// ほかの項目は伏せたまま
		expect(profileValue("生年月日").textContent).toContain(
			"伏せ字にしています",
		);

		fireEvent.click(
			screen.getByRole("button", { name: "メールアドレスを隠す" }),
		);
		expect(document.body.textContent).not.toContain("player@example.com");

		fireEvent.click(screen.getByRole("button", { name: "生年月日を表示" }));
		expect(profileValue("生年月日").textContent).toContain("2000年1月2日");
	});

	it("表示した値は、別の画面へ移って戻ると伏せ直されている", async () => {
		await importSynthetic();
		openScreen("アカウント");
		fireEvent.click(
			screen.getByRole("button", { name: "メールアドレスを表示" }),
		);

		openScreen("概要");
		openScreen("アカウント");

		expectAbsent("player@example.com");
	});

	it("変更履歴を新しい順に並べ、出来事の名前に元の値を添える", async () => {
		await importSynthetic();
		openScreen("アカウント");

		expect(tableRows(card("アカウントの変更履歴"))).toEqual([
			[
				"2022年2月3日 13:05",
				"アカウントの連携の作成（LINKED_IDENTITY_CREATED）",
				"—",
			],
			["2021年2月3日 13:05", "メールの送信（EMAIL）", "delivered"],
			[
				"2016年5月6日 16:08",
				"アカウントの状態の変更（ACCOUNT_STATE_CHANGED）",
				"—",
			],
			["2014年5月6日 16:08", "パスワードの変更（PASSWORD_CHANGED）", "—"],
		]);
	});

	it("ペナルティを、たたまずに 1 件ずつ表示する", async () => {
		await importSynthetic();
		openScreen("アカウント");

		const section = card("ペナルティ");
		expect(within(section).getByRole("heading", { level: 3 }).textContent).toBe(
			"チャットの制限（CHAT_RESTRICTION）",
		);
		expect(section.textContent).toContain("2018年1月2日 12:04 に発行");
		const facts = within(section)
			.getAllByRole("term")
			.map((term) => [term.textContent, term.nextElementSibling?.textContent]);
		expect(facts).toEqual([
			["対象", "League of Legends"],
			// 対応が分からない値は、元の値のまま表示する
			["理由", "SAMPLE_REASON"],
			["処分の形", "期間つき（TIMEOUT）"],
			["状態", "期間が終了（LAPSED）"],
			["発行の方法", "自動"],
		]);
	});

	it("通報の件数を表示する", async () => {
		await importSynthetic();
		openScreen("アカウント");

		expect(tableRows(card("通報の件数"))).toEqual([
			[
				"League of Legends",
				"自分が通報した",
				"放置や途中での離脱（LEAVING_AFK）",
				"2",
			],
		]);
	});

	it("問い合わせのやりとりを、改行を保って古い順に表示する", async () => {
		await importSynthetic();
		openScreen("アカウント");

		const section = card("問い合わせ");
		expect(within(section).getByRole("heading", { level: 3 }).textContent).toBe(
			"ログインについて",
		);
		expect(section.textContent).toContain("完了（closed）");
		const messages = within(section).getAllByRole("listitem");
		// 問い合わせ 1 件と、やりとり 2 件
		expect(messages).toHaveLength(3);
		expect(messages[1]?.textContent).toContain("自分（Player）");
		expect(messages[1]?.textContent).toContain(
			"ログインできません。\n確認をお願いします。",
		);
		expect(messages[2]?.textContent).toContain("サポート担当（Agent）");
	});

	it("チャットログは、発言があった試合だけを並べ、無い試合は数で示す", async () => {
		await importSynthetic();
		openScreen("アカウント");

		const section = card("チャットログ");
		expect(section.textContent).toContain("ログがある試合3 試合");
		expect(section.textContent).toContain("発言が無い試合2 試合");
		expect(section.textContent).toContain("発言1 件");
		expect(within(section).getByRole("heading", { level: 3 }).textContent).toBe(
			"League of Legends・2026年1月2日",
		);
		expect(section.textContent).toContain("Tester#JP1");
		expect(section.textContent).toContain("試合中・チームあて");
		expect(section.textContent).toContain("gl hf");
	});

	it("IP アドレスは初めは伏せ、押すとまとめて表示する", async () => {
		await importSynthetic();
		openScreen("アカウント");

		const list = card("IP アドレスの一覧");
		expectAbsent("203.0.113", "2001:db8");
		const rows = tableRows(list);
		expect(rows).toHaveLength(3);
		// 順位、回数、場面ごとの回数は、伏せていても見える
		expect(rows[0]?.[0]).toBe("1");
		// 支払い 1 回と、LoL のストアの取引 2 回
		expect(rows[0]?.slice(2, 6)).toEqual(["3", "0", "1", "2"]);

		fireEvent.click(
			within(list).getByRole("button", { name: "アドレスを表示" }),
		);
		expect(tableRows(list).map((row) => row[1])).toEqual([
			"203.0.113.8",
			"203.0.113.7",
			"2001:db8::1",
		]);

		fireEvent.click(
			within(list).getByRole("button", { name: "アドレスを隠す" }),
		);
		expect(list.textContent).not.toContain("203.0.113");
	});

	it("ページを送っても表示は保ち、伏せ字モードを入れるとどのページでも伏せる", async () => {
		await importSynthetic({
			extra: {
				[LOGIN_PATH]: Array.from({ length: 30 }, (_, index) => ({
					event_time_utc: `2024-03-${String(index + 1).padStart(2, "0")} 09:00:00`,
					event_type: "Login",
					ip_address: `198.51.100.${index + 1}`,
					product: "League/TFT PC",
				})),
			},
		});
		openScreen("アカウント");
		const list = card("IP アドレスの一覧");
		expect(list.textContent).toContain("1〜25 件目（全 32 件）");

		fireEvent.click(
			within(list).getByRole("button", { name: "アドレスを表示" }),
		);
		fireEvent.click(within(list).getByRole("button", { name: "次のページ" }));

		// アドレスを表示しても、ページは先頭に戻らない
		expect(list.textContent).toContain("26〜32 件目（全 32 件）");
		expect(list.textContent).toContain("198.51.100.");

		toggleMask();
		expectAbsent("198.51.100", "203.0.113");
		expect(list.textContent).toContain("26〜32 件目（全 32 件）");
	});

	it("期間を変えると、表示していた IP アドレスを伏せ直す", async () => {
		await importSynthetic();
		openScreen("アカウント");
		fireEvent.click(screen.getByRole("button", { name: "アドレスを表示" }));

		choosePeriod("2021");

		expectAbsent("203.0.113");
		expect(tableRows(card("IP アドレスの一覧"))).toHaveLength(1);
		expect(
			screen.getByRole("button", { name: "アドレスを表示" }),
		).toBeDefined();
	});

	it("年を選ぶと、日時のある記録をその年の分に絞る。通報の件数と登録情報は変わらない", async () => {
		await importSynthetic();
		openScreen("アカウント");
		choosePeriod("2021");

		expect(tableRows(card("アカウントの変更履歴"))).toHaveLength(1);
		expect(card("ペナルティ").textContent).toContain(
			"この期間に、ペナルティの記録はありません。",
		);
		expect(card("問い合わせ").textContent).toContain(
			"この期間に、問い合わせの記録はありません。",
		);
		expect(card("チャットログ").textContent).toContain(
			"この期間に、チャットログの記録はありません。",
		);
		expect(tableRows(card("通報の件数"))).toHaveLength(1);
		expect(profileValue("Riot ID").textContent).toBe("Tester#JP1");
	});
});

describe("伏せ字モード", () => {
	it("入れると、Riot ID、ユーザー名、件名、本文を伏せる", async () => {
		await importSynthetic();
		openScreen("アカウント");

		toggleMask();

		expect(
			screen
				.getByRole("button", { name: "伏せ字" })
				.getAttribute("aria-pressed"),
		).toBe("true");
		expectAbsent(
			"Tester#JP1",
			"Tester",
			"ログインについて",
			"ログインできません",
			"確認しました",
			"gl hf",
			"player@example.com",
			"203.0.113",
		);
		expect(profileValue("Riot ID").textContent).toContain("伏せ字にしています");
		// 個人を特定しない項目は、そのまま見せる
		expect(profileValue("LoL のプラットフォーム").textContent).toBe("JP1");
		expect(card("ペナルティ").textContent).toContain("チャットの制限");
	});

	it("入れている間は、伏せた値を表示する操作を出さない", async () => {
		await importSynthetic();
		openScreen("アカウント");
		fireEvent.click(
			screen.getByRole("button", { name: "メールアドレスを表示" }),
		);
		fireEvent.click(screen.getByRole("button", { name: "アドレスを表示" }));

		toggleMask();

		// 表示していた値も、伏せ直す
		const text = document.body.textContent ?? "";
		expect(text).not.toContain("player@example.com");
		expect(text).not.toContain("203.0.113");
		expect(screen.queryByRole("button", { name: /を表示$/ })).toBeNull();
		expect(screen.queryByRole("button", { name: /を隠す$/ })).toBeNull();
	});

	it("切っても、入れる前に表示していた値を勝手には表示しない", async () => {
		await importSynthetic();
		openScreen("アカウント");
		fireEvent.click(
			screen.getByRole("button", { name: "メールアドレスを表示" }),
		);
		fireEvent.click(screen.getByRole("button", { name: "アドレスを表示" }));

		toggleMask();
		toggleMask();

		const text = document.body.textContent ?? "";
		expect(text).not.toContain("player@example.com");
		expect(text).not.toContain("203.0.113");
		expect(
			screen.getByRole("button", { name: "メールアドレスを表示" }),
		).toBeDefined();
		expect(
			screen.getByRole("button", { name: "アドレスを表示" }),
		).toBeDefined();
	});

	it("データを破棄して読み込み直しても、入れたままにする", async () => {
		await importSynthetic();
		toggleMask();

		fireEvent.click(screen.getByRole("button", { name: "データを破棄" }));
		choose(zipFile(buildSyntheticZip()));
		await screen.findByRole("heading", { level: 1, name: "概要" });

		expect(
			screen
				.getByRole("button", { name: "伏せ字" })
				.getAttribute("aria-pressed"),
		).toBe("true");
		openScreen("アカウント");
		expectAbsent("Tester#JP1", "ログインについて", "gl hf");
	});

	it("対応が分からない値（宛先、書き手、補足）は、元の値が出るので伏せる", async () => {
		const files = syntheticExportFiles();
		const chatPath = "leagueoflegends/chat_logs_v2_uc/successes/100000001.json";
		const chat = structuredClone(files[chatPath]) as {
			chat_logs: { in_game: Array<{ sent_to: string }> };
		};
		// 特定の相手あての発言。宛先に相手の Riot ID が入っている場合を想定する
		const [first] = chat.chat_logs.in_game;
		if (first) {
			first.sent_to = "Friend#JP9";
		}
		const tickets = structuredClone(
			files["zendesk/zendesk_tickets.json"],
		) as Record<string, { comments: Array<{ author: string }> }>;
		const [comment] = tickets["10000001"]?.comments ?? [];
		if (comment) {
			comment.author = "Tanaka Taro";
		}
		await importSynthetic({
			extra: {
				[chatPath]: chat,
				"zendesk/zendesk_tickets.json": tickets,
				"riotAccount/account_audit_events_v2_uc.json": [
					{
						event_type: "USER_FIELD_CHANGED",
						description: "new-address@example.com",
						event_date: "2021-02-03 04:05:06",
					},
					{
						event_type: "EMAIL",
						description: "delivered",
						event_date: "2021-02-04 04:05:06",
					},
				],
			},
		});
		openScreen("アカウント");

		// ふだんは、元の値のまま表示する
		expect(card("チャットログ").textContent).toContain("Friend#JP9あて");
		expect(card("問い合わせ").textContent).toContain("Tanaka Taro");
		expect(card("アカウントの変更履歴").textContent).toContain(
			"new-address@example.com",
		);

		toggleMask();

		expectAbsent("Friend#JP9", "Tanaka Taro", "new-address@example.com");
		// 短い語だけの補足と、対応が分かっている値は、そのまま見せる
		expect(card("アカウントの変更履歴").textContent).toContain("delivered");
		expect(card("問い合わせ").textContent).toContain("サポート担当（Agent）");
	});

	it("概要、ゲーム、課金の画面には、もともと個人を特定する値を出さない", async () => {
		await importSynthetic();

		for (const name of [
			"概要",
			"活動",
			"League of Legends",
			"VALORANT",
			"課金",
		]) {
			openScreen(name);
			expectAbsent("Tester#JP1", "player@example.com", "203.0.113", "2001:db8");
		}
	});

	it("読み込み結果では、対応していないファイルのパスを伏せる", async () => {
		// 展開したフォルダを圧縮し直した zip では、既知のフォルダの外にあるファイルのパスに、
		// 包んでいるフォルダの名前（Riot ID を含むことがある）が残る
		await importSynthetic({
			wrapper: "Tester-JP1",
			extra: { "extra/unknown_file.json": [] },
		});
		openScreen("読み込み結果");
		expect(document.body.textContent).toContain(
			"tester-jp1/extra/unknown_file.json",
		);

		toggleMask();

		expectAbsent("tester-jp1");
		// 対応しているファイルの行は、そのまま見せる
		expect(
			within(screen.getByRole("region", { name: "VALORANT" })).getByRole(
				"row",
				{
					name: /試合履歴/,
				},
			),
		).toBeDefined();
	});

	it("画面を移っても保ち、切ると元に戻る", async () => {
		await importSynthetic();
		toggleMask();

		openScreen("アカウント");
		expect(document.body.textContent).not.toContain("Tester#JP1");

		toggleMask();
		expect(profileValue("Riot ID").textContent).toBe("Tester#JP1");
		expect(
			screen.getByRole("button", { name: "メールアドレスを表示" }),
		).toBeDefined();
	});
});
