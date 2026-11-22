import { type ReactNode, useMemo } from "react";
import { type QueueRecord, queueRecords } from "../../analysis/matches.ts";
import { ChartCard } from "../../components/ChartCard.tsx";
import { BarList, type BarListRow } from "../../components/charts/BarList.tsx";
import { SeriesLegend } from "../../components/charts/Legend.tsx";
import { type Column, DataTable } from "../../components/DataTable.tsx";
import {
	formatDuration,
	formatNumber,
	formatPercent,
} from "../../labels/format.ts";
import {
	QUEUE_CATEGORY_LABELS,
	queueLabel,
	queueText,
} from "../../labels/queues.ts";
import type { Match } from "../../model/types.ts";
import { outcomeSeries } from "./outcomeSeries.ts";
import { WinLossText } from "./WinLossText.tsx";

const COLUMNS: Column<QueueRecord>[] = [
	{ header: "種別", cell: (row) => queueText(row.name) },
	{ header: "区分", cell: (row) => QUEUE_CATEGORY_LABELS[row.category] },
	{ header: "試合数", numeric: true, cell: (row) => formatNumber(row.matches) },
	{
		header: "勝ち",
		numeric: true,
		cell: (row) => (row.counted ? formatNumber(row.wins) : "—"),
	},
	{
		header: "負け",
		numeric: true,
		cell: (row) => (row.counted ? formatNumber(row.losses) : "—"),
	},
	{
		header: "勝率",
		numeric: true,
		cell: (row) => (row.winRate === null ? "—" : formatPercent(row.winRate)),
	},
	{
		header: "プレイ時間",
		numeric: true,
		cell: (row) => formatDuration(row.playSeconds),
	},
];

interface QueueRecordCardProps {
	matches: readonly Match[];
	/** 勝敗の数え方についての、ゲーム固有の説明。 */
	description: ReactNode;
}

/** 種別ごとの試合数と勝敗。棒の長さは試合数、色の割合は勝ち負けを表す。 */
export function QueueRecordCard({
	matches,
	description,
}: QueueRecordCardProps) {
	const { records, series, rows } = useMemo(() => {
		const records = queueRecords(matches);
		const others = (record: QueueRecord) =>
			record.matches - record.wins - record.losses;
		const series = outcomeSeries(
			records.some((record) => others(record) > 0),
			"勝敗を数えない",
		);
		const rows: BarListRow[] = records.map((record) => {
			const { label, raw } = queueLabel(record.name);
			const category = QUEUE_CATEGORY_LABELS[record.category];
			return {
				key: record.key,
				label,
				note: raw === null ? category : `${category}・元の値は ${raw}`,
				values: [record.wins, record.losses, others(record)],
				value: record.counted ? (
					<WinLossText record={record} />
				) : (
					`${formatNumber(record.matches)} 回`
				),
			};
		});
		return { records, series, rows };
	}, [matches]);

	if (records.length === 0) {
		return null;
	}

	return (
		<ChartCard
			title="種別ごとの勝敗"
			description={description}
			legend={<SeriesLegend items={series} />}
			chart={
				<BarList series={series} rows={rows} label="種別ごとの試合数と勝敗" />
			}
			table={
				<DataTable
					caption="種別ごとの勝敗"
					columns={COLUMNS}
					rows={records}
					rowKey={(row) => row.key}
				/>
			}
		/>
	);
}
