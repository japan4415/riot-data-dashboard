// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createScreenLoader, LazyScreen } from "./LazyScreen.tsx";

afterEach(cleanup);

function Sample() {
	return <h1>読み込んだ画面</h1>;
}

describe("createScreenLoader", () => {
	it("読み込みは 1 度だけ行い、結果を覚える", async () => {
		const importer = vi.fn(async (): Promise<ComponentType> => Sample);
		const loader = createScreenLoader(importer);

		expect(loader.loaded()).toBeNull();
		expect(await loader.load()).toBe(Sample);
		expect(await loader.load()).toBe(Sample);
		expect(importer).toHaveBeenCalledTimes(1);
		expect(loader.loaded()).toBe(Sample);
	});

	it("同時に呼ばれても、読み込みは 1 度だけ行う", async () => {
		const importer = vi.fn(async (): Promise<ComponentType> => Sample);
		const loader = createScreenLoader(importer);

		await Promise.all([loader.load(), loader.load()]);

		expect(importer).toHaveBeenCalledTimes(1);
	});

	it("失敗は覚えず、次に呼ばれたら読み込み直す", async () => {
		const importer = vi
			.fn<() => Promise<ComponentType>>()
			.mockRejectedValueOnce(new Error("通信できません"))
			.mockResolvedValueOnce(Sample);
		const loader = createScreenLoader(importer);

		await expect(loader.load()).rejects.toThrow("通信できません");
		expect(loader.loaded()).toBeNull();
		expect(await loader.load()).toBe(Sample);
		expect(importer).toHaveBeenCalledTimes(2);
	});
});

describe("LazyScreen", () => {
	it("読み込んでいる間は、その旨を伝え、終わったら画面を出す", async () => {
		const loader = createScreenLoader(async () => Sample);

		render(<LazyScreen loader={loader} />);

		expect(screen.getByRole("status").textContent).toBe(
			"画面を読み込んでいます。",
		);
		expect(
			await screen.findByRole("heading", { name: "読み込んだ画面" }),
		).toBeDefined();
		expect(screen.queryByRole("status")).toBeNull();
	});

	it("読み込み済みなら、待たずに画面を出す", async () => {
		const loader = createScreenLoader(async () => Sample);
		await loader.load();

		render(<LazyScreen loader={loader} />);

		expect(
			screen.getByRole("heading", { name: "読み込んだ画面" }),
		).toBeDefined();
	});

	it("読み込みに失敗しても落ちず、もう一度試せる", async () => {
		const importer = vi
			.fn<() => Promise<ComponentType>>()
			.mockRejectedValueOnce(new Error("通信できません"))
			.mockResolvedValueOnce(Sample);
		const loader = createScreenLoader(importer);

		render(<LazyScreen loader={loader} />);

		const alert = await screen.findByRole("alert");
		expect(alert.textContent).toContain("この画面を読み込めませんでした");
		expect(alert.textContent).toContain("ほかの画面は、そのまま使えます");

		fireEvent.click(screen.getByRole("button", { name: "もう一度試す" }));

		expect(
			await screen.findByRole("heading", { name: "読み込んだ画面" }),
		).toBeDefined();
		expect(screen.queryByRole("alert")).toBeNull();
		expect(importer).toHaveBeenCalledTimes(2);
	});

	it("もう一度試しても失敗したら、同じ案内を出し直す", async () => {
		const importer = vi
			.fn<() => Promise<ComponentType>>()
			.mockRejectedValue(new Error("通信できません"));
		const loader = createScreenLoader(importer);
		render(<LazyScreen loader={loader} />);
		await screen.findByRole("alert");

		fireEvent.click(screen.getByRole("button", { name: "もう一度試す" }));

		expect(await screen.findByRole("alert")).toBeDefined();
		expect(importer).toHaveBeenCalledTimes(2);
	});

	it("読み込みが終わる前に画面を離れても、問題を起こさない", async () => {
		let finish: (component: ComponentType) => void = () => {};
		const loader = createScreenLoader(
			() =>
				new Promise<ComponentType>((resolve) => {
					finish = resolve;
				}),
		);
		const { unmount } = render(<LazyScreen loader={loader} />);

		unmount();
		finish(Sample);
		await loader.load();

		// 離れたあとに読み込みが終わっても、次に開いたときはすぐに出せる
		render(<LazyScreen loader={loader} />);
		expect(
			screen.getByRole("heading", { name: "読み込んだ画面" }),
		).toBeDefined();
	});
});
