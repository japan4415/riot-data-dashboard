import { useMemo } from "react";
import { Link } from "wouter";
import type { ActivityGroup } from "../../analysis/activity.ts";
import type { GameScreen } from "../../analysis/games.ts";
import {
	type GroupSummary,
	groupSummaries,
	overviewStats,
	recordSpan,
} from "../../analysis/overview.ts";
import { periodLabel } from "../../analysis/period.ts";
import { useDashboard } from "../../app/DashboardContext.tsx";
import { EmptyState } from "../../components/EmptyState.tsx";
import { PageHeading } from "../../components/PageHeading.tsx";
import { StatRow, StatTile } from "../../components/StatTile.tsx";
import {
	ACTIVITY_GROUP_COLORS,
	ACTIVITY_GROUP_LABELS,
} from "../../labels/activity.ts";
import {
	durationQuantity,
	formatDayShort,
	formatDuration,
	formatMoney,
	formatNumber,
	formatPercent,
	formatSpan,
} from "../../labels/format.ts";
import { GAME_ORDER, gameLabel } from "../../labels/games.ts";
import type { GameId } from "../../model/types.ts";
import { ActivityTrendCard } from "../activity/ActivityTrendCard.tsx";
import { CalendarCard } from "../activity/CalendarCard.tsx";
import { GAME_PATHS } from "../games/paths.ts";
import pageStyles from "../Page.module.css";
import styles from "./OverviewPage.module.css";

/** 活動の区分に対応する、ゲームの画面。TFT（モバイルほか）には専用の画面が無い。 */
const GROUP_SCREENS: Readonly<Partial<Record<ActivityGroup, GameScreen>>> = {
	"lol-tft-pc": "lol",
	valorant: "valorant",
	wildrift: "wildrift",
	lor: "lor",
};

interface GroupCardProps {
	summary: GroupSummary;
	/** くわしい画面へのパス。画面が無ければ省く。 */
	detailPath?: string;
}

function GroupCard({ summary, detailPath }: GroupCardProps) {
	const { record } = summary;
	return (
		<li className={styles.group}>
			<h3 className={styles.groupTitle}>
				<span
					className={styles.groupKey}
					style={{ backgroundColor: ACTIVITY_GROUP_COLORS[summary.group] }}
				/>
				{ACTIVITY_GROUP_LABELS[summary.group]}
			</h3>
			<dl className={styles.groupFacts}>
				<div>
					<dt>活動した日数</dt>
					<dd>{formatNumber(summary.activeDays)} 日</dd>
				</div>
				{summary.firstDay !== null && summary.lastDay !== null && (
					<div>
						<dt>記録の期間</dt>
						<dd>
							<span className={styles.nowrap}>
								{formatDayShort(summary.firstDay)} 〜
							</span>{" "}
							<span className={styles.nowrap}>
								{formatDayShort(summary.lastDay)}
							</span>
						</dd>
					</div>
				)}
				{record && (
					<>
						<div>
							<dt>試合数</dt>
							<dd>{formatNumber(record.matches)} 試合</dd>
						</div>
						<div>
							<dt>勝敗</dt>
							<dd>
								{record.winRate === null ? (
									"—"
								) : (
									<>
										<span className={styles.nowrap}>
											{formatNumber(record.wins)} 勝{" "}
											{formatNumber(record.losses)} 敗
										</span>{" "}
										<span className={styles.nowrap}>
											（勝率 {formatPercent(record.winRate)}）
										</span>
									</>
								)}
							</dd>
						</div>
						<div>
							<dt>プレイ時間</dt>
							<dd>{formatDuration(record.playSeconds)}</dd>
						</div>
					</>
				)}
			</dl>
			{!record && (
				<p className={styles.groupNote}>
					試合履歴は、Riot の開示データに含まれません。
				</p>
			)}
			{detailPath && (
				<Link href={detailPath} className={styles.more}>
					{summary.group === "lol-tft-pc"
						? "League of Legends のストアの取引を見る"
						: `${ACTIVITY_GROUP_LABELS[summary.group]} をくわしく見る`}
				</Link>
			)}
		</li>
	);
}

/** 概要の画面。アカウント全体の記録を要約する。 */
export function OverviewPage() {
	const { dataset, activity, period, toLocal, gameScreens } = useDashboard();

	const span = useMemo(() => recordSpan(dataset), [dataset]);
	const stats = useMemo(
		() => overviewStats(dataset, activity, period, toLocal),
		[dataset, activity, period, toLocal],
	);
	const summaries = useMemo(
		() => groupSummaries(dataset, activity, period, toLocal),
		[dataset, activity, period, toLocal],
	);
	// 試合履歴があるゲームを、画面に並べる決まった順で挙げる
	const matchGames = useMemo(() => {
		const games = new Set<GameId>(dataset.matches.map((match) => match.game));
		return GAME_ORDER.filter(
			(game): game is GameId => game !== null && games.has(game),
		);
	}, [dataset]);

	const detailPath = (group: ActivityGroup) => {
		const screen = GROUP_SCREENS[group];
		return screen && gameScreens.includes(screen)
			? GAME_PATHS[screen]
			: undefined;
	};

	const calendarYear =
		period.kind === "year" ? period.year : activity.years.at(-1);
	const hasActivity = stats.activeDays > 0;

	return (
		<div className={pageStyles.page}>
			<PageHeading title="概要">
				{span
					? `${formatSpan(span, toLocal)}の記録があります。`
					: "日時のある記録が見つかりませんでした。"}
				{period.kind === "year" &&
					`${periodLabel(period)}の分を表示しています。`}
			</PageHeading>

			<StatRow>
				<StatTile
					label="活動した日数"
					value={formatNumber(stats.activeDays)}
					unit="日"
				/>
				{stats.hasMatches && (
					<>
						<StatTile
							label="試合数"
							value={formatNumber(stats.matches)}
							unit="試合"
							note="練習を除く"
						/>
						<StatTile
							label="プレイ時間"
							{...durationQuantity(stats.playSeconds)}
							note="試合履歴にある時間の合計"
						/>
					</>
				)}
				{stats.spending.map((total) => (
					<StatTile
						key={total.currency}
						label={`課金額（${total.currency}）`}
						value={formatMoney(total)}
					/>
				))}
			</StatRow>

			{stats.hasMatches && (
				<p className={pageStyles.footnote}>
					試合数とプレイ時間は、試合履歴がある{" "}
					{matchGames.map((game) => gameLabel(game)).join("、")}{" "}
					の合計です。League of Legends と Teamfight Tactics の試合履歴は、Riot
					の開示データに含まれません。
				</p>
			)}

			{hasActivity ? (
				<>
					<ActivityTrendCard />

					<h2 className={pageStyles.sectionHeading}>ゲームごとの記録</h2>
					<ul className={styles.groups}>
						{summaries.map((summary) => (
							<GroupCard
								key={summary.group}
								summary={summary}
								detailPath={detailPath(summary.group)}
							/>
						))}
					</ul>

					{calendarYear !== undefined && (
						<CalendarCard
							years={[calendarYear]}
							title={`活動カレンダー（${calendarYear} 年）`}
							action={
								period.kind === "all" && activity.years.length > 1 ? (
									<Link href="/activity" className={styles.more}>
										すべての年を見る
									</Link>
								) : undefined
							}
						/>
					)}
				</>
			) : (
				<EmptyState>この期間に、ログインと試合の記録はありません。</EmptyState>
			)}
		</div>
	);
}
