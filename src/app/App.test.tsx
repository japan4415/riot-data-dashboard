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

afterEach(cleanup);

function zipFile(bytes: Uint8Array, name = "export.zip"): File {
	return new File([bytes as BlobPart], name, { type: "application/zip" });
}

function choose(file: File) {
	fireEvent.change(screen.getByLabelText("zip ファイル"), {
		target: { files: [file] },
	});
}

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

		expect(screen.getByRole("contentinfo").textContent).toContain(
			"Riot Games が提供または承認するものではありません",
		);
	});
});

describe("App: zip の読み込み", () => {
	it("zip を選ぶと、読み込み結果を表示する", async () => {
		render(<App />);

		choose(zipFile(buildSyntheticZip()));

		const heading = await screen.findByRole("heading", {
			level: 1,
			name: "読み込み結果",
		});
		expect(document.activeElement).toBe(heading);

		const valorant = screen.getByRole("region", { name: "VALORANT" });
		const row = within(valorant).getByRole("row", { name: /試合履歴/ });
		expect(within(row).getByText("読み込み済み")).toBeDefined();
		expect(within(row).getAllByRole("cell")[1]?.textContent).toBe("3");
	});

	it("ゲームごとに分けて表示し、対応していないファイルはパスで示す", async () => {
		render(<App />);

		choose(zipFile(buildSyntheticZip()));
		await screen.findByRole("heading", { level: 1, name: "読み込み結果" });

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

		const twoXko = screen.getByRole("region", { name: "2XKO" });
		expect(
			within(twoXko).getByText("2xko/2xko_audio_transcripts_uc.json"),
		).toBeDefined();
		expect(within(twoXko).getAllByText("記録なし")).toHaveLength(2);
	});

	it("複数のファイルをまとめた行には、ファイル数を添える", async () => {
		render(<App />);

		choose(zipFile(buildSyntheticZip()));
		await screen.findByRole("heading", { level: 1, name: "読み込み結果" });

		const lol = screen.getByRole("region", { name: "League of Legends" });
		const row = within(lol).getByRole("row", { name: /チャットログ/ });
		expect(row.textContent).toContain("2 ファイル");
	});

	it("データを破棄すると、最初の画面に戻る", async () => {
		render(<App />);

		choose(zipFile(buildSyntheticZip()));
		fireEvent.click(
			await screen.findByRole("button", { name: "データを破棄して最初に戻る" }),
		);

		expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
			"アカウントデータを振り返る",
		);
		expect(screen.queryByText("読み込み結果")).toBeNull();
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
