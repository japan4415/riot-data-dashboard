import { useMemo } from "react";
import {
	busiestSlot,
	daysInPeriod,
	hourWeekMatrix,
	longestStreak,
} from "../../analysis/activity.ts";
import { periodLabel } from "../../analysis/period.ts";
import { useDashboard } from "../../app/DashboardContext.tsx";
import { EmptyState } from "../../components/EmptyState.tsx";
import { PageHeading } from "../../components/PageHeading.tsx";
import { StatRow, StatTile } from "../../components/StatTile.tsx";
import {
	formatDayShort,
	formatNumber,
	formatSlot,
} from "../../labels/format.ts";
import pageStyles from "../Page.module.css";
import { ActivityTrendCard } from "./ActivityTrendCard.tsx";
import { CalendarCard } from "./CalendarCard.tsx";
import { HourWeekCard } from "./HourWeekCard.tsx";

/** 活動の画面。いつ遊んだかを、日、曜日、時刻の単位で示す。 */
export function ActivityPage() {
	const { activity, period } = useDashboard();

	const { activeDays, streak, busiest } = useMemo(() => {
		const days = daysInPeriod(activity, period);
		return {
			activeDays: days.length,
			streak: longestStreak(days),
			busiest: busiestSlot(hourWeekMatrix(activity, period)),
		};
	}, [activity, period]);

	// 新しい年を上に並べる
	const years = useMemo(
		() =>
			period.kind === "year" ? [period.year] : [...activity.years].reverse(),
		[activity, period],
	);

	return (
		<div className={pageStyles.page}>
			<PageHeading title="活動">
				{periodLabel(period)}
				の、ログイン記録と試合履歴から求めた活動です。Riot
				アカウント共通の記録（クライアントの起動や認証）は含めていません。
			</PageHeading>

			{activeDays === 0 ? (
				<EmptyState>この期間に、ログインと試合の記録はありません。</EmptyState>
			) : (
				<>
					<StatRow>
						<StatTile
							label="活動した日数"
							value={`${formatNumber(activeDays)} 日`}
						/>
						{streak && (
							<StatTile
								label="最長の連続日数"
								value={`${formatNumber(streak.length)} 日`}
								note={
									streak.length > 1
										? `${formatDayShort(streak.start)} 〜 ${formatDayShort(streak.end)}`
										: formatDayShort(streak.start)
								}
							/>
						)}
						{busiest && (
							<StatTile
								label="もっとも多い時間帯"
								value={formatSlot(busiest.weekday, busiest.hour)}
								note={`ログインと試合 ${formatNumber(busiest.count)} 回`}
							/>
						)}
					</StatRow>

					<HourWeekCard />
					<ActivityTrendCard />
					<CalendarCard years={years} title="活動カレンダー" />
				</>
			)}
		</div>
	);
}
