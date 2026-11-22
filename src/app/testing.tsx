import { fireEvent, render, screen, within } from "@testing-library/react";
import {
	buildSyntheticZip,
	type SyntheticZipOptions,
} from "../../tests/fixtures/syntheticExport.ts";
import { App } from "./App.tsx";

/** 画面のテストで共通に使う操作。 */

export function zipFile(bytes: Uint8Array, name = "export.zip"): File {
	return new File([bytes as BlobPart], name, { type: "application/zip" });
}

export function choose(file: File) {
	fireEvent.change(screen.getByLabelText("zip ファイル"), {
		target: { files: [file] },
	});
}

/** 合成したデータを読み込み、概要の画面が出るまで待つ。 */
export async function importSynthetic(options?: SyntheticZipOptions) {
	render(<App />);
	choose(zipFile(buildSyntheticZip(options)));
	return screen.findByRole("heading", { level: 1, name: "概要" });
}

export function menu() {
	return screen.getByRole("navigation", { name: "画面" });
}

export function openScreen(name: string) {
	fireEvent.click(within(menu()).getByRole("link", { name }));
}

/** 数値の枠から、見出しに対応する値を読む。 */
export function statValue(label: string): string | null {
	const term = screen
		.getAllByRole("term")
		.find((element) => element.textContent === label);
	return term?.nextElementSibling?.textContent ?? null;
}

/** 数値の枠から、見出しに対応する補足を読む。 */
export function statNote(label: string): string | null {
	const term = screen
		.getAllByRole("term")
		.find((element) => element.textContent === label);
	return term?.nextElementSibling?.nextElementSibling?.textContent ?? null;
}

/** 図表の枠を、表の表示に切り替えて返す。 */
export function showTable(title: string): HTMLElement {
	const card = screen.getByRole("region", { name: title });
	fireEvent.click(within(card).getByRole("button", { name: "表" }));
	return card;
}

/** 表の本体の行を、セルの文字列の配列として読む。 */
export function tableRows(container: HTMLElement): string[][] {
	const [, ...rows] = within(container).getAllByRole("row");
	return rows.map((row) =>
		[...row.querySelectorAll("th, td")].map((cell) => cell.textContent ?? ""),
	);
}
