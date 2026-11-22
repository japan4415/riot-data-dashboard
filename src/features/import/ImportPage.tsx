import { type DragEvent, useEffect, useRef, useState } from "react";
import { ImportError } from "../../import/archive.ts";
import type { ImportResult } from "../../import/importArchive.ts";
import styles from "./ImportPage.module.css";
import { importFromFile, importSample } from "./importFromFile.ts";

const DATA_HANDLING = [
	{
		title: "ブラウザの中だけで処理します",
		body: "zip の展開と集計は、すべてこのブラウザの中で行います。",
	},
	{
		title: "サーバーには送りません",
		body: "ファイルの中身は、どこにも送信しません。",
	},
	{
		title: "保存しません",
		body: "ページを閉じるか再読み込みすると、読み込んだデータは消えます。",
	},
] as const;

function messageOf(error: unknown): string {
	if (error instanceof ImportError) {
		switch (error.code) {
			case "not-zip":
				return "zip ファイルとして読めませんでした。Riot Games から届いたファイルを、展開せずにそのまま選んでください。";
			case "not-riot-export":
				return "この zip には、Riot Games の開示データが見つかりませんでした。";
			case "too-large":
				return "ファイルが大きすぎるため、読み込みを中止しました。";
		}
	}
	return "読み込み中に問題が起きました。もう一度お試しください。";
}

type Status =
	| { kind: "idle" }
	| { kind: "reading" }
	| { kind: "error"; message: string };

interface ImportPageProps {
	/** 読み込みが終わったときに呼ぶ。`sample` は、合成したサンプルデータかどうか。 */
	onImported: (result: ImportResult, sample: boolean) => void;
}

export function ImportPage({ onImported }: ImportPageProps) {
	const [status, setStatus] = useState<Status>({ kind: "idle" });
	const [dragging, setDragging] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const reading = status.kind === "reading";

	// 枠の外に落としたファイルをブラウザが開いてしまい、ページを離れるのを防ぐ
	useEffect(() => {
		const prevent = (event: Event) => event.preventDefault();
		window.addEventListener("dragover", prevent);
		window.addEventListener("drop", prevent);
		return () => {
			window.removeEventListener("dragover", prevent);
			window.removeEventListener("drop", prevent);
		};
	}, []);

	async function read(file: File | undefined) {
		if (!file || reading) {
			return;
		}
		setStatus({ kind: "reading" });
		try {
			onImported(await importFromFile(file), false);
		} catch (error) {
			setStatus({ kind: "error", message: messageOf(error) });
		}
	}

	async function readSample() {
		if (reading) {
			return;
		}
		setStatus({ kind: "reading" });
		try {
			onImported(await importSample(), true);
		} catch (error) {
			setStatus({ kind: "error", message: messageOf(error) });
		}
	}

	function handleDrop(event: DragEvent<HTMLDivElement>) {
		event.preventDefault();
		setDragging(false);
		void read(event.dataTransfer.files[0]);
	}

	function handleDragOver(event: DragEvent<HTMLDivElement>) {
		event.preventDefault();
		setDragging(true);
	}

	function handleDragLeave(event: DragEvent<HTMLDivElement>) {
		// 枠の中の要素へ移っただけのときは、枠から出たとみなさない
		if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
			setDragging(false);
		}
	}

	return (
		<>
			<section className={styles.intro} aria-labelledby="intro-heading">
				<h1 id="intro-heading" className={styles.heading}>
					Riot Games のアカウントデータを振り返る
				</h1>
				<p className={styles.lead}>
					Riot Games に開示を請求して届いた zip
					ファイルを読み込み、遊んだ時間、勝敗、課金の記録を表示します。
				</p>

				{/* biome-ignore lint/a11y/noStaticElementInteractions: ドロップは補助的な操作で、同じことをボタンからできる */}
				<div
					className={styles.dropZone}
					data-dragging={dragging || undefined}
					data-reading={reading || undefined}
					onDragOver={handleDragOver}
					onDragLeave={handleDragLeave}
					onDrop={handleDrop}
				>
					<input
						ref={inputRef}
						className={styles.fileInput}
						type="file"
						accept=".zip,application/zip"
						aria-label="zip ファイル"
						tabIndex={-1}
						onChange={(event) => {
							void read(event.target.files?.[0]);
							// 同じファイルを選び直しても反応するように、選択を空に戻す
							event.target.value = "";
						}}
					/>
					<button
						type="button"
						className={styles.chooseButton}
						disabled={reading}
						onClick={() => inputRef.current?.click()}
					>
						{reading ? "読み込んでいます…" : "zip ファイルを選ぶ"}
					</button>
					<p className={styles.dropHint}>または、ここにファイルをドロップ</p>
					<p className={styles.status} role="status">
						{reading ? "データを読み込んでいます。" : ""}
					</p>
					{status.kind === "error" && (
						<p className={styles.error} role="alert">
							{status.message}
						</p>
					)}
				</div>

				<p className={styles.sample}>
					開示データが手元に無いときは、作りもののデータで画面を試せます。
					<button
						type="button"
						className={styles.sampleButton}
						disabled={reading}
						onClick={() => void readSample()}
					>
						サンプルデータで試す
					</button>
				</p>
			</section>

			<section
				className={styles.handling}
				aria-labelledby="data-handling-heading"
			>
				<h2 id="data-handling-heading" className={styles.sectionHeading}>
					データの扱い
				</h2>
				<ul className={styles.cards}>
					{DATA_HANDLING.map((item) => (
						<li key={item.title} className={styles.card}>
							<h3 className={styles.cardTitle}>{item.title}</h3>
							<p className={styles.cardBody}>{item.body}</p>
						</li>
					))}
				</ul>
			</section>
		</>
	);
}
