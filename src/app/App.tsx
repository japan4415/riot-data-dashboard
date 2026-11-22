import { type ReactNode, useState } from "react";
import { Link, Redirect, Route, Switch, useLocation } from "wouter";
import { ActivityPage } from "../features/activity/ActivityPage.tsx";
import { ImportPage } from "../features/import/ImportPage.tsx";
import { OverviewPage } from "../features/overview/OverviewPage.tsx";
import { ImportReportPage } from "../features/report/ImportReportPage.tsx";
import type { ImportResult } from "../import/importArchive.ts";
import styles from "./App.module.css";
import { DashboardProvider } from "./DashboardContext.tsx";
import { PeriodSelect } from "./PeriodSelect.tsx";

const REPOSITORY_URL = "https://github.com/japan4415/riot-data-dashboard";

/** メニューに並べる画面。名前は、その画面にあるものを表す。 */
const SCREENS = [
	{ path: "/", label: "概要" },
	{ path: "/activity", label: "活動" },
	{ path: "/files", label: "読み込み結果" },
] as const;

interface FrameProps {
	/** 上部の帯の右側に置くもの。 */
	barAction?: ReactNode;
	wide?: boolean;
	children: ReactNode;
}

/** すべての画面に共通の枠。上部の帯と、下部の注記を持つ。 */
function Frame({ barAction, wide = false, children }: FrameProps) {
	return (
		<div className={styles.shell} data-wide={wide || undefined}>
			<header className={styles.bar}>
				<div className={styles.barInner}>
					<span className={styles.appName}>Riot データダッシュボード</span>
					{barAction}
				</div>
			</header>

			{children}

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

function Navigation({ onDiscard }: { onDiscard: () => void }) {
	const [location] = useLocation();
	return (
		<nav className={styles.nav} aria-label="画面">
			<ul className={styles.navList}>
				{SCREENS.map((screen) => (
					<li key={screen.path}>
						<Link
							href={screen.path}
							className={styles.navLink}
							aria-current={location === screen.path ? "page" : undefined}
						>
							{screen.label}
						</Link>
					</li>
				))}
			</ul>
			<button type="button" className={styles.discard} onClick={onDiscard}>
				データを破棄
			</button>
		</nav>
	);
}

export function App() {
	// 読み込んだデータはメモリ上だけに置く。再読み込みすると消える
	const [result, setResult] = useState<ImportResult | null>(null);
	const [, navigate] = useLocation();

	if (!result) {
		return (
			<Frame>
				<main className={styles.main}>
					<ImportPage
						onImported={(imported) => {
							setResult(imported);
							navigate("/");
						}}
					/>
				</main>
			</Frame>
		);
	}

	return (
		<DashboardProvider result={result}>
			<Frame wide barAction={<PeriodSelect />}>
				<div className={styles.dashboard}>
					<Navigation
						onDiscard={() => {
							setResult(null);
							navigate("/");
						}}
					/>
					<main className={styles.content}>
						<Switch>
							<Route path="/" component={OverviewPage} />
							<Route path="/activity" component={ActivityPage} />
							<Route path="/files">
								<ImportReportPage result={result} />
							</Route>
							<Route>
								<Redirect to="/" />
							</Route>
						</Switch>
					</main>
				</div>
			</Frame>
		</DashboardProvider>
	);
}
