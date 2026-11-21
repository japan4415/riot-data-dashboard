import {
	type ImportResult,
	importArchive,
} from "../../import/importArchive.ts";

/** 次の描画が終わるまで待つ。読み込み中の表示を、重い処理の前に画面へ出すために使う。 */
function nextPaint(): Promise<void> {
	return new Promise((resolve) => {
		if (typeof requestAnimationFrame === "function") {
			requestAnimationFrame(() => setTimeout(resolve, 0));
		} else {
			setTimeout(resolve, 0);
		}
	});
}

/**
 * 利用者が選んだ zip を読み込む。
 *
 * ファイルはブラウザのメモリに読むだけで、どこにも送信しない。
 */
export async function importFromFile(file: File): Promise<ImportResult> {
	const buffer = await file.arrayBuffer();
	await nextPaint();
	return importArchive(new Uint8Array(buffer));
}
