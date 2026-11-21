// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App.tsx";

afterEach(cleanup);

describe("App", () => {
	it("アプリケーション名と最初の見出しを表示する", () => {
		render(<App />);

		expect(screen.getByRole("banner").textContent).toContain(
			"Riot データダッシュボード",
		);
		expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
			"アカウントデータを振り返る",
		);
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
