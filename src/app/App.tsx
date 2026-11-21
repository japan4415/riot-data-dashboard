import { useState } from "react";
import { ImportPage } from "../features/import/ImportPage.tsx";
import { ImportReportPage } from "../features/report/ImportReportPage.tsx";
import type { ImportResult } from "../import/importArchive.ts";
import styles from "./App.module.css";

const REPOSITORY_URL = "https://github.com/japan4415/riot-data-dashboard";

export function App() {
	// 読み込んだデータはメモリ上だけに置く。再読み込みすると消える
	const [result, setResult] = useState<ImportResult | null>(null);

	return (
		<div className={styles.shell}>
			<header className={styles.bar}>
				<div className={styles.barInner}>
					<span className={styles.appName}>Riot データダッシュボード</span>
				</div>
			</header>

			<main className={styles.main}>
				{result ? (
					<ImportReportPage result={result} onDiscard={() => setResult(null)} />
				) : (
					<ImportPage onImported={setResult} />
				)}
			</main>

			<footer className={styles.footer}>
				<p>このサイトは Riot Games が提供または承認するものではありません。</p>
				<p>
					<a
						className={styles.footerLink}
						href={REPOSITORY_URL}
						rel="noreferrer"
					>
						ソースコード（GitHub）
					</a>
				</p>
			</footer>
		</div>
	);
}
