import { type ReactNode, useMemo } from "react";
import {
	type DayActivity,
	daysInPeriod,
	levelThresholds,
} from "../../analysis/activity.ts";
import { dayKeyParts } from "../../analysis/localTime.ts";
import { useDashboard } from "../../app/DashboardContext.tsx";
import { ChartCard } from "../../components/ChartCard.tsx";
import { CalendarHeatmap } from "../../components/charts/CalendarHeatmap.tsx";
import { LevelLegend } from "../../components/charts/Legend.tsx";
import { type Column, DataTable } from "../../components/DataTable.tsx";
import { ACTIVITY_GROUP_LABELS } from "../../labels/activity.ts";
import { formatDay, formatNumber } from "../../labels/format.ts";
import styles from "./CalendarCard.module.css";

const COLUMNS: Column<DayActivity>[] = [
	{ header: "日付", cell: (row) => formatDay(row.day) },
	{
		header: "ログインと試合の回数",
		numeric: true,
		cell: (row) => formatNumber(row.count),
	},
	{
		header: "ゲーム",
		cell: (row) =>
			row.groups.map((group) => ACTIVITY_GROUP_LABELS[group]).join("、"),
	},
];

interface CalendarCardProps {
	/** 表示する年。新しい順に並べる。 */
	years: readonly number[];
	title: string;
	action?: ReactNode;
}

/** 活動カレンダー。年ごとに 1 つずつ並べる。 */
export function CalendarCard({ years, title, action }: CalendarCardProps) {
	const { activity, period } = useDashboard();

	const { thresholds, rows, activeDaysByYear } = useMemo(() => {
		const days = daysInPeriod(activity, period);
		const shown = new Set(years);
		const rows = days.filter((day) => shown.has(dayKeyParts(day.day).year));
		const activeDaysByYear = new Map<number, number>();
		for (const day of rows) {
			const year = dayKeyParts(day.day).year;
			activeDaysByYear.set(year, (activeDaysByYear.get(year) ?? 0) + 1);
		}
		return {
			// 濃淡の境界は期間全体でそろえ、年どうしを比べられるようにする
			thresholds: levelThresholds(days.map((day) => day.count)),
			rows: rows.reverse(),
			activeDaysByYear,
		};
	}, [activity, period, years]);

	return (
		<ChartCard
			title={title}
			description="色が濃いほど、その日のログインと試合の回数が多いことを表します。日付は、このブラウザのタイムゾーンで区切っています。"
			legend={<LevelLegend unit="回数" />}
			action={action}
			chart={
				<div className={styles.years}>
					{years.map((year) => (
						<section key={year} className={styles.year}>
							{years.length > 1 && (
								<h3 className={styles.yearHeading}>
									{year} 年
									<span className={styles.yearNote}>
										活動した日 {formatNumber(activeDaysByYear.get(year) ?? 0)}{" "}
										日
									</span>
								</h3>
							)}
							<CalendarHeatmap
								year={year}
								days={activity.days}
								thresholds={thresholds}
							/>
						</section>
					))}
				</div>
			}
			table={
				<DataTable
					caption={title}
					columns={COLUMNS}
					rows={rows}
					rowKey={(row) => row.day}
					empty="この期間に活動の記録はありません。"
				/>
			}
		/>
	);
}
