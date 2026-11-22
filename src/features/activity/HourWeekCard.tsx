import { useMemo } from "react";
import { hourWeekMatrix } from "../../analysis/activity.ts";
import { useDashboard } from "../../app/DashboardContext.tsx";
import { ChartCard } from "../../components/ChartCard.tsx";
import { HourWeekHeatmap } from "../../components/charts/HourWeekHeatmap.tsx";
import { LevelLegend } from "../../components/charts/Legend.tsx";
import { type Column, DataTable } from "../../components/DataTable.tsx";
import { WEEKDAY_LABELS } from "../../labels/activity.ts";
import { formatNumber } from "../../labels/format.ts";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/** 曜日と時刻ごとの、ログインと試合の回数。 */
export function HourWeekCard() {
	const { activity, period } = useDashboard();
	const matrix = useMemo(
		() => hourWeekMatrix(activity, period),
		[activity, period],
	);

	// 表は行を時刻、列を曜日にする。24 列を横に並べるより、狭い画面でも読みやすい
	const columns: Column<number>[] = [
		{ header: "時刻", cell: (hour) => `${hour} 時台` },
		...WEEKDAY_LABELS.map((label, weekday) => ({
			header: `${label}曜`,
			numeric: true,
			cell: (hour: number) => formatNumber(matrix[weekday]?.[hour] ?? 0),
		})),
	];

	return (
		<ChartCard
			title="曜日と時刻"
			description="ログインと試合の回数を、曜日と時刻ごとに数えています。時刻は、このブラウザのタイムゾーンです。"
			legend={<LevelLegend unit="回数" />}
			chart={<HourWeekHeatmap matrix={matrix} />}
			table={
				<DataTable
					caption="曜日と時刻ごとの、ログインと試合の回数"
					columns={columns}
					rows={HOURS}
					rowKey={(hour) => hour}
				/>
			}
		/>
	);
}
