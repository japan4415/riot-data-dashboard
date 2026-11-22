import {
	type ComponentType,
	type ReactNode,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import { Link, Redirect, Route, Switch, useLocation } from "wouter";
import type { GameScreen } from "../analysis/games.ts";
import { AccountPage } from "../features/account/AccountPage.tsx";
import { ActivityPage } from "../features/activity/ActivityPage.tsx";
import { LolPage } from "../features/games/LolPage.tsx";
import { LorPage } from "../features/games/LorPage.tsx";
import { GAME_PATHS } from "../features/games/paths.ts";
import { ValorantPage } from "../features/games/ValorantPage.tsx";
import { WildRiftPage } from "../features/games/WildRiftPage.tsx";
import { ImportPage } from "../features/import/ImportPage.tsx";
import { OverviewPage } from "../features/overview/OverviewPage.tsx";
import { ImportReportPage } from "../features/report/ImportReportPage.tsx";
import { SpendingPage } from "../features/spending/SpendingPage.tsx";
import type { ImportResult } from "../import/importArchive.ts";
import { gameLabel } from "../labels/games.ts";
import styles from "./App.module.css";
import { DashboardProvider, useDashboard } from "./DashboardContext.tsx";
import { MaskToggle } from "./MaskToggle.tsx";
import { PeriodSelect } from "./PeriodSelect.tsx";

const REPOSITORY_URL = "https://github.com/japan4415/riot-data-dashboard";

interface Screen {
	path: string;
	label: string;
}

/** ゲームごとの画面。記録があるゲームだけを、メニューと経路に出す。 */
const GAME_PAGES: Readonly<Record<GameScreen, ComponentType>> = {
	lol: LolPage,
	valorant: ValorantPage,
	lor: LorPage,
	wildrift: WildRiftPage,
};

/** メニューのまとまり。名前は、その画面にあるものを表す。 */
interface ScreenGroup {
	/** まとまりの見出し。先頭のまとまりには付けない。 */
	heading?: string;
	screens: Screen[];
}

function screenGroups(games: readonly GameScreen[]): ScreenGroup[] {
	const groups: ScreenGroup[] = [
		{
			screens: [
				{ path: "/", label: "概要" },
				{ path: "/activity", label: "活動" },
			],
		},
	];
	if (games.length > 0) {
		groups.push({
			heading: "ゲーム",
			screens: games.map((game) => ({
				path: GAME_PATHS[game],
				label: gameLabel(game),
			})),
		});
	}
	groups.push(
		{
			heading: "記録",
			screens: [
				{ path: "/spending", label: "課金" },
				{ path: "/account", label: "アカウント" },
			],
		},
		{
			heading: "データ",
			screens: [{ path: "/files", label: "読み込み結果" }],
		},
	);
	return groups;
}

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
	const { gameScreens } = useDashboard();
	const navId = useId();
	const scrollerRef = useRef<HTMLDivElement>(null);

	// 幅が狭い画面ではメニューが横にスクロールする。いまいる画面の名前が隠れていたら、見える位置まで寄せる
	// biome-ignore lint/correctness/useExhaustiveDependencies: 画面が切り替わるたびに位置を確かめ直す
	useEffect(() => {
		const scroller = scrollerRef.current;
		const current = scroller?.querySelector('[aria-current="page"]');
		if (!scroller || !current) {
			return;
		}
		const frame = scroller.getBoundingClientRect();
		const link = current.getBoundingClientRect();
		const margin = 48;
		if (link.left < frame.left + margin) {
			scroller.scrollLeft += link.left - frame.left - margin;
		} else if (link.right > frame.right - margin) {
			scroller.scrollLeft += link.right - frame.right + margin;
		}
	}, [location]);

	return (
		<nav className={styles.nav} aria-label="画面">
			<div ref={scrollerRef} className={styles.navGroups}>
				{screenGroups(gameScreens).map((group, index) => {
					// まとまりの見出しを、その下の一覧の名前にする
					const headingId = group.heading ? `${navId}-${index}` : undefined;
					return (
						<div key={group.heading ?? "main"} className={styles.navGroup}>
							{group.heading && (
								<p id={headingId} className={styles.navHeading}>
									{group.heading}
								</p>
							)}
							<ul className={styles.navList} aria-labelledby={headingId}>
								{group.screens.map((screen) => (
									<li key={screen.path}>
										<Link
											href={screen.path}
											className={styles.navLink}
											aria-current={
												location === screen.path ? "page" : undefined
											}
										>
											{screen.label}
										</Link>
									</li>
								))}
							</ul>
						</div>
					);
				})}
			</div>
			<button type="button" className={styles.discard} onClick={onDiscard}>
				データを破棄
			</button>
		</nav>
	);
}

/** 読み込み後の画面。記録があるゲームの経路だけを用意する。 */
function Screens({ result }: { result: ImportResult }) {
	const { gameScreens } = useDashboard();
	return (
		<Switch>
			<Route path="/" component={OverviewPage} />
			<Route path="/activity" component={ActivityPage} />
			{gameScreens.map((game) => (
				<Route
					key={game}
					path={GAME_PATHS[game]}
					component={GAME_PAGES[game]}
				/>
			))}
			<Route path="/spending" component={SpendingPage} />
			<Route path="/account" component={AccountPage} />
			<Route path="/files">
				<ImportReportPage result={result} />
			</Route>
			<Route>
				<Redirect to="/" />
			</Route>
		</Switch>
	);
}

export function App() {
	// 読み込んだデータはメモリ上だけに置く。再読み込みすると消える
	const [result, setResult] = useState<ImportResult | null>(null);
	// 伏せ字モードは、データを破棄しても切らない。次に読み込んだデータが、伏せないまま表示されるのを防ぐ
	const [maskMode, setMaskMode] = useState(false);
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
		<DashboardProvider
			result={result}
			maskMode={maskMode}
			onMaskModeChange={setMaskMode}
		>
			<Frame
				wide
				barAction={
					<div className={styles.barControls}>
						<MaskToggle />
						<PeriodSelect />
					</div>
				}
			>
				<div className={styles.dashboard}>
					<Navigation
						onDiscard={() => {
							setResult(null);
							navigate("/");
						}}
					/>
					<main className={styles.content}>
						<Screens result={result} />
					</main>
				</div>
			</Frame>
		</DashboardProvider>
	);
}
