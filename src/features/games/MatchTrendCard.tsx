import { useMemo } from "react";
import { matchBuckets, QUEUE_CATEGORIES } from "../../analysis/matches.ts";
import { useDashboard } from "../../app/DashboardContext.tsx";
import { ChartCard } from "../../components/ChartCard.tsx";
import { SeriesLegend } from "../../components/charts/Legend.tsx";
import {
	type BarBucket,
	StackedBars,
} from "../../components/charts/StackedBars.tsx";
import { type Column, DataTable } from "../../components/DataTable.tsx";
import { formatNumber } from "../../labels/format.ts";
import {
	QUEUE_CATEGORY_COLORS,
	QUEUE_CATEGORY_LABELS,
} from "../../labels/queues.ts";
import type { Match } from "../../model/types.ts";

/** 図に出す区分。練習は試合数に数えないので、図にも出さない。 */
const CHART_CATEGORIES = QUEUE_CATEGORIES.filter(
	(category) => category !== "practice",
);

/** 区分ごとの試合数の推移。全期間では年ごと、1 年分では月ごとに並べる。 */
export function MatchTrendCard({ matches }: { matches: readonly Match[] }) {
	const { period, toLocal } = useDashboard();

	const { series, buckets, undated } = useMemo(() => {
		const raw = matchBuckets(matches, period, toLocal);
		// 期間内に 1 試合も無い区分は、凡例にも棒にも出さない。色は区分に固定なので、残りの色は変わらない
		const categories = CHART_CATEGORIES.filter((category) =>
			raw.buckets.some((bucket) => bucket.counts[category] > 0),
		);
		const series = categories.map((category) => ({
			id: category,
			label: QUEUE_CATEGORY_LABELS[category],
			color: QUEUE_CATEGORY_COLORS[category],
		}));
		const buckets: BarBucket[] = raw.buckets.map((bucket) => ({
			key: bucket.key,
			label: period.kind === "all" ? `${bucket.key}年` : `${bucket.key}月`,
			shortLabel:
				period.kind === "all"
					? `'${String(bucket.key % 100).padStart(2, "0")}`
					: String(bucket.key),
			values: categories.map((category) => bucket.counts[category]),
		}));
		return { series, buckets, undated: raw.undated };
	}, [matches, period, toLocal]);

	if (series.length === 0) {
		return null;
	}

	const columns: Column<BarBucket>[] = [
		{ header: period.kind === "all" ? "年" : "月", cell: (row) => row.label },
		...series.map((item, index) => ({
			header: item.label,
			numeric: true,
			cell: (row: BarBucket) => formatNumber(row.values[index] ?? 0),
		})),
	];
	const title = period.kind === "all" ? "年ごとの試合数" : "月ごとの試合数";

	return (
		<ChartCard
			title={title}
			description={
				<>
					練習を除いた試合を、区分ごとに数えています。
					{undated > 0 &&
						`時刻の記録が無い ${formatNumber(undated)} 試合は、図に含めていません。`}
				</>
			}
			legend={series.length > 1 ? <SeriesLegend items={series} /> : undefined}
			chart={
				<StackedBars
					series={series}
					buckets={buckets}
					unit="試合"
					label={`${title}。棒を選ぶと、その期間の値を確かめられます。`}
				/>
			}
			table={
				<DataTable
					caption={title}
					columns={columns}
					rows={buckets}
					rowKey={(row) => row.key}
				/>
			}
		/>
	);
}
