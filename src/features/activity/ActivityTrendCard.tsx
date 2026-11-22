import { useMemo } from "react";
import { ACTIVITY_GROUPS, activityBuckets } from "../../analysis/activity.ts";
import { useDashboard } from "../../app/DashboardContext.tsx";
import { ChartCard } from "../../components/ChartCard.tsx";
import { SeriesLegend } from "../../components/charts/Legend.tsx";
import {
	type BarBucket,
	StackedBars,
} from "../../components/charts/StackedBars.tsx";
import { type Column, DataTable } from "../../components/DataTable.tsx";
import {
	ACTIVITY_GROUP_COLORS,
	ACTIVITY_GROUP_LABELS,
} from "../../labels/activity.ts";
import { formatNumber } from "../../labels/format.ts";

/** ゲームごとの活動日数の推移。全期間では年ごと、1 年分では月ごとに並べる。 */
export function ActivityTrendCard() {
	const { activity, period } = useDashboard();

	const { series, buckets } = useMemo(() => {
		const raw = activityBuckets(activity, period);
		// 期間内に 1 日も活動が無い区分は、凡例にも棒にも出さない。色は区分に固定なので、残りの色は変わらない
		const groups = ACTIVITY_GROUPS.filter((group) =>
			raw.some((bucket) => bucket.activeDays[group] > 0),
		);
		const series = groups.map((group) => ({
			id: group,
			label: ACTIVITY_GROUP_LABELS[group],
			color: ACTIVITY_GROUP_COLORS[group],
		}));
		const buckets: BarBucket[] = raw.map((bucket) => ({
			key: bucket.key,
			label: period.kind === "all" ? `${bucket.key}年` : `${bucket.key}月`,
			shortLabel:
				period.kind === "all"
					? `'${String(bucket.key % 100).padStart(2, "0")}`
					: String(bucket.key),
			values: groups.map((group) => bucket.activeDays[group]),
		}));
		return { series, buckets };
	}, [activity, period]);

	const columns: Column<BarBucket>[] = [
		{ header: period.kind === "all" ? "年" : "月", cell: (row) => row.label },
		...series.map((item, index) => ({
			header: item.label,
			numeric: true,
			cell: (row: BarBucket) => formatNumber(row.values[index] ?? 0),
		})),
	];

	return (
		<ChartCard
			title="ゲーム別の活動日数"
			description="ログインまたは試合の記録があった日を、ゲームごとに数えています。複数のゲームの記録がある日は、それぞれに数えます。"
			legend={series.length > 1 ? <SeriesLegend items={series} /> : undefined}
			chart={
				<StackedBars
					series={series}
					buckets={buckets}
					unit="日"
					label="ゲーム別の活動日数。棒を選ぶと、その期間の値を確かめられます。"
				/>
			}
			table={
				<DataTable
					caption="ゲーム別の活動日数"
					columns={columns}
					rows={buckets}
					rowKey={(row) => row.key}
				/>
			}
		/>
	);
}
