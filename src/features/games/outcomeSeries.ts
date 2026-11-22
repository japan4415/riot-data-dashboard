import type { LegendItem } from "../../components/charts/Legend.tsx";

/**
 * 勝ち、負け、勝敗なしの系列。色は系列に固定で、並び順も変えない。
 * 勝敗なしが 1 件も無いときは、`withOthers` を false にして系列から外す。
 */
export function outcomeSeries(
	withOthers: boolean,
	othersLabel = "勝敗なし",
): LegendItem[] {
	const series: LegendItem[] = [
		{ id: "wins", label: "勝ち", color: "var(--chart-series-1)" },
		{ id: "losses", label: "負け", color: "var(--chart-series-2)" },
	];
	if (withOthers) {
		series.push({
			id: "others",
			label: othersLabel,
			color: "var(--chart-series-3)",
		});
	}
	return series;
}
