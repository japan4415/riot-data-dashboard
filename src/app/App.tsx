import { ImportPage } from "../features/import/ImportPage.tsx";
import styles from "./App.module.css";

const REPOSITORY_URL = "https://github.com/japan4415/riot-data-dashboard";

export function App() {
	return (
		<div className={styles.shell}>
			<header className={styles.bar}>
				<div className={styles.barInner}>
					<span className={styles.appName}>Riot データダッシュボード</span>
				</div>
			</header>

			<main className={styles.main}>
				<ImportPage />
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
