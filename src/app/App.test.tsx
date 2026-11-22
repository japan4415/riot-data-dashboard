// @vitest-environment jsdom
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
	buildSyntheticZip,
	syntheticExportFiles,
} from "../../tests/fixtures/syntheticExport.ts";
import { App } from "./App.tsx";
import {
	choose,
	importSynthetic,
	openScreen,
	statValue,
	zipFile,
} from "./testing.tsx";

afterEach(() => {
	cleanup();
	window.history.replaceState(null, "", "/");
});

describe("App: 読み込み前", () => {
	it("アプリケーション名と最初の見出しを表示する", () => {
		render(<App />);

		expect(screen.getByRole("banner").textContent).toContain(
			"Riot データダッシュボード",
		);
		expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
			"アカウントデータを振り返る",
		);
		expect(
			screen.getByRole("button", { name: "zip ファイルを選ぶ" }),
		).toBeDefined();
		expect(screen.queryByRole("navigation", { name: "画面" })).toBeNull();
	});

	it("データをブラウザの外に出さないことを説明する", () => {
		render(<App />);

		const headings = screen
			.getAllByRole("heading", { level: 3 })
			.map((heading) => heading.textContent);
		expect(headings).toEqual([
			"ブラウザの中だけで処理します",
			"サーバーには送りません",
			"保存しません",
		]);
	});

	it("Riot Games の公式サイトではないことを明記する", () => {
		render(<App />);

		const footer = screen.getByRole("contentinfo").textContent ?? "";
		expect(footer).toContain(
			"Riot Games が提供または承認するものではありません",
		);
		expect(footer).toContain("Riot Games, Inc. の商標または登録商標です");
		// Riot Games の規約が表示を求めている文言
		expect(footer).toContain(
			'was created under Riot Games\' "Legal Jibber Jabber" policy using assets owned by Riot Games',
		);
		expect(footer).toContain(
			"Riot Games does not endorse or sponsor this project.",
		);
	});

	it("zip でないファイルには、理由を添えてエラーを表示する", async () => {
		render(<App />);

		choose(new File(["これは zip ではない"], "memo.txt"));

		const alert = await screen.findByRole("alert");
		expect(alert.textContent).toContain("zip ファイルとして読めませんでした");
		expect(
			screen.getByRole("button", { name: "zip ファイルを選ぶ" }),
		).toBeDefined();
	});

	it("開示データではない zip には、その旨を表示する", async () => {
		render(<App />);

		// 開示データのファイルをすべて取り除くと、readme.csv だけの zip になる
		choose(
			zipFile(buildSyntheticZip({ omit: Object.keys(syntheticExportFiles()) })),
		);

		const alert = await screen.findByRole("alert");
		expect(alert.textContent).toContain("開示データが見つかりませんでした");
	});
});

describe("App: サンプルデータ", () => {
	function trySample() {
		fireEvent.click(
			screen.getByRole("button", { name: "サンプルデータで試す" }),
		);
	}

	it("サンプルデータで画面を試せる。作りもののデータであることを明記する", async () => {
		render(<App />);

		trySample();

		await screen.findByRole("heading", { level: 1, name: "概要" });
		expect(screen.getByRole("note").textContent).toContain(
			"サンプルデータを表示しています",
		);
		expect(screen.getByRole("note").textContent).toContain(
			"実在のアカウントの記録ではありません",
		);
		// すべてのゲームの画面を試せる
		const links = within(screen.getByRole("navigation", { name: "画面" }))
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
		expect(
			Number(statValue("活動した日数")?.replace(/\D/g, "")),
		).toBeGreaterThan(1000);
	});

	it("画面を移っても、サンプルデータであることを示し続ける", async () => {
		render(<App />);
		trySample();
		await screen.findByRole("heading", { level: 1, name: "概要" });

		openScreen("アカウント");

		expect(screen.getByRole("note").textContent).toContain(
			"サンプルデータを表示しています",
		);
	});

	it("自分のファイルを読み込んだときは、サンプルデータの表示を出さない", async () => {
		render(<App />);
		trySample();
		await screen.findByRole("heading", { level: 1, name: "概要" });

		fireEvent.click(screen.getByRole("button", { name: "データを破棄" }));
		choose(zipFile(buildSyntheticZip()));
		await screen.findByRole("heading", { level: 1, name: "概要" });

		expect(screen.queryByRole("note")).toBeNull();
	});
});

describe("App: 概要", () => {
	it("zip を選ぶと、概要の画面へ移り、見出しにフォーカスを移す", async () => {
		const heading = await importSynthetic();

		expect(document.activeElement).toBe(heading);
		expect(document.title).toBe("概要 | Riot データダッシュボード");
		expect(
			within(screen.getByRole("navigation", { name: "画面" }))
				.getByRole("link", { name: "概要" })
				.getAttribute("aria-current"),
		).toBe("page");
	});

	it("主要な数値を表示する", async () => {
		await importSynthetic();

		expect(statValue("活動した日数")).toBe("6 日");
		expect(statValue("試合数")).toBe("4 試合");
		expect(statValue("プレイ時間")).toBe("2 時間");
		expect(statValue("課金額（JPY）")).toContain("3,100");
		expect(statValue("課金額（USD）")).toContain("12.00");
	});

	it("ゲームごとの記録を表示し、試合履歴が無いゲームにはその旨を添える", async () => {
		await importSynthetic();

		const titles = screen
			.getAllByRole("heading", { level: 3 })
			.map((heading) => heading.textContent);
		expect(titles).toEqual([
			"LoL / TFT（PC）",
			"VALORANT",
			"Wild Rift",
			"Legends of Runeterra",
		]);

		const lol = screen
			.getByRole("heading", { level: 3, name: "LoL / TFT（PC）" })
			.closest("li");
		expect(lol?.textContent).toContain(
			"試合履歴は、Riot の開示データに含まれません。",
		);

		const valorant = screen
			.getByRole("heading", { level: 3, name: "VALORANT" })
			.closest("li");
		expect(valorant?.textContent).toContain("2 試合");
		expect(valorant?.textContent).toContain("1 勝 1 敗");
		expect(valorant?.textContent).toContain("（勝率 50.0%）");
	});

	it("期間を選ぶと、その年の数値に切り替わる", async () => {
		await importSynthetic();

		fireEvent.change(screen.getByLabelText("期間"), {
			target: { value: "2024" },
		});

		expect(statValue("活動した日数")).toBe("1 日");
		expect(statValue("試合数")).toBe("1 試合");
		expect(statValue("課金額（USD）")).toBeNull();
		expect(
			screen.getByRole("heading", {
				level: 2,
				name: "活動カレンダー（2024 年）",
			}),
		).toBeDefined();
	});

	it("図を表に切り替えると、同じ内容を表で確かめられる", async () => {
		await importSynthetic();

		const card = screen.getByRole("region", { name: "ゲーム別の活動日数" });
		fireEvent.click(within(card).getByRole("button", { name: "表" }));

		const table = within(card).getByRole("table");
		const row = within(table).getByRole("row", { name: /2024年/ });
		expect(within(row).getAllByRole("cell")[1]?.textContent).toBe("1");
		expect(
			within(card)
				.getByRole("button", { name: "表" })
				.getAttribute("aria-pressed"),
		).toBe("true");
	});
});

describe("App: 活動", () => {
	it("メニューから活動の画面へ移る", async () => {
		await importSynthetic();

		openScreen("活動");

		const heading = screen.getByRole("heading", { level: 1, name: "活動" });
		expect(document.activeElement).toBe(heading);
		expect(window.location.pathname).toBe("/activity");
		expect(statValue("活動した日数")).toBe("6 日");
		expect(statValue("最長の連続日数")).toBe("1 日");
	});

	it("曜日と時刻、推移、カレンダーの図表を表示する", async () => {
		await importSynthetic();
		openScreen("活動");

		const cards = screen
			.getAllByRole("heading", { level: 2 })
			.map((heading) => heading.textContent);
		expect(cards).toEqual([
			"曜日と時刻",
			"ゲーム別の活動日数",
			"活動カレンダー",
		]);

		// 記録がある最初の年から最後の年まで、年ごとにカレンダーを並べる
		const years = screen
			.getAllByRole("heading", { level: 3 })
			.map((heading) => heading.textContent?.slice(0, 6));
		expect(years[0]).toBe("2024 年");
		expect(years.at(-1)).toBe("2019 年");
	});

	it("カレンダーを表に切り替えると、活動した日を新しい順に並べる", async () => {
		await importSynthetic();
		openScreen("活動");

		const card = screen.getByRole("region", { name: "活動カレンダー" });
		fireEvent.click(within(card).getByRole("button", { name: "表" }));

		const rows = within(card).getAllByRole("rowheader");
		expect(rows).toHaveLength(6);
		expect(rows[0]?.textContent).toBe("2024年3月1日（金）");
		expect(rows.at(-1)?.textContent).toBe("2019年12月1日（日）");
	});

	it("記録が無い年を選ぶと、その旨を表示する", async () => {
		await importSynthetic();
		openScreen("活動");

		fireEvent.change(screen.getByLabelText("期間"), {
			target: { value: "2022" },
		});

		expect(
			screen.getByText("この期間に、ログインと試合の記録はありません。"),
		).toBeDefined();
	});
});

describe("App: 読み込み結果", () => {
	it("ゲームごとに分けて表示し、対応していないファイルはパスで示す", async () => {
		await importSynthetic();
		openScreen("読み込み結果");

		expect(
			screen.getByRole("heading", { level: 1, name: "読み込み結果" }),
		).toBeDefined();

		const groups = screen
			.getAllByRole("heading", { level: 2 })
			.map((heading) => heading.textContent);
		expect(groups).toEqual([
			"アカウント",
			"League of Legends",
			"Teamfight Tactics",
			"VALORANT",
			"Legends of Runeterra",
			"Wild Rift",
			"2XKO",
			"状態の意味",
		]);

		const valorant = screen.getByRole("region", { name: "VALORANT" });
		const row = within(valorant).getByRole("row", { name: /試合履歴/ });
		expect(within(row).getByText("読み込み済み")).toBeDefined();
		expect(within(row).getAllByRole("cell")[1]?.textContent).toBe("3");

		const twoXko = screen.getByRole("region", { name: "2XKO" });
		expect(
			within(twoXko).getByText("2xko/2xko_audio_transcripts_uc.json"),
		).toBeDefined();
		expect(within(twoXko).getAllByText("記録なし")).toHaveLength(2);
	});

	it("複数のファイルをまとめた行には、ファイル数を添える", async () => {
		await importSynthetic();
		openScreen("読み込み結果");

		const lol = screen.getByRole("region", { name: "League of Legends" });
		const row = within(lol).getByRole("row", { name: /チャットログ/ });
		expect(row.textContent).toContain("2 ファイル");
	});
});

describe("App: 画面の移動", () => {
	it("データを破棄すると、最初の画面に戻る", async () => {
		await importSynthetic();
		openScreen("活動");

		fireEvent.click(screen.getByRole("button", { name: "データを破棄" }));

		expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
			"アカウントデータを振り返る",
		);
		expect(screen.queryByRole("navigation", { name: "画面" })).toBeNull();
		expect(window.location.pathname).toBe("/");
	});

	it("存在しないパスを開いていても、読み込み後は概要へ移る", async () => {
		window.history.replaceState(null, "", "/no-such-screen");

		await importSynthetic();

		expect(window.location.pathname).toBe("/");
	});
});
