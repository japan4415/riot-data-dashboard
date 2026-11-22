import { useMemo } from "react";
import {
	type FactionCombo,
	factionCombos,
	medianTurns,
	outcomeReasons,
	type ReasonRecord,
	type TurnBin,
	turnHistogram,
} from "../../analysis/lor.ts";
import { matchesOf, matchSummary } from "../../analysis/matches.ts";
import { transactionsInPeriod, transactionsOf } from "../../analysis/store.ts";
import { useDashboard } from "../../app/DashboardContext.tsx";
import { ChartCard } from "../../components/ChartCard.tsx";
import { BarList, type BarListRow } from "../../components/charts/BarList.tsx";
import { SeriesLegend } from "../../components/charts/Legend.tsx";
import {
	type BarBucket,
	StackedBars,
} from "../../components/charts/StackedBars.tsx";
import { type Column, DataTable } from "../../components/DataTable.tsx";
import { StatTile } from "../../components/StatTile.tsx";
import { formatNumber, formatPercent } from "../../labels/format.ts";
import type { LorMatch } from "../../model/types.ts";
import { GamePage } from "./GamePage.tsx";
import { MatchTiles } from "./MatchTiles.tsx";
import { MatchTrendCard } from "./MatchTrendCard.tsx";
import { outcomeSeries } from "./outcomeSeries.ts";
import { PurchaseListCard } from "./PurchaseListCard.tsx";
import { QueueRecordCard } from "./QueueRecordCard.tsx";
import { WinLossText } from "./WinLossText.tsx";

/** 決着の理由の、日本語での補足。対応が分からない値には付けない。 */
const REASON_NOTES: Readonly<Record<string, string>> = {
	concession: "降参",
	"zero health": "体力が 0",
	disconnect: "切断",
};

function comboLabel(combo: FactionCombo): string {
	return combo.factions.length === 0
		? "地域の記録なし"
		: combo.factions.join(" + ");
}

function binLabel(bin: TurnBin): string {
	return bin.to === null ? `${bin.from} 以上` : `${bin.from}〜${bin.to}`;
}

const winRateCell = (row: { winRate: number | null }) =>
	row.winRate === null ? "—" : formatPercent(row.winRate);

const COMBO_COLUMNS: Column<FactionCombo>[] = [
	{ header: "地域", cell: comboLabel },
	{ header: "試合数", numeric: true, cell: (row) => formatNumber(row.matches) },
	{ header: "勝ち", numeric: true, cell: (row) => formatNumber(row.wins) },
	{ header: "負け", numeric: true, cell: (row) => formatNumber(row.losses) },
	{ header: "勝率", numeric: true, cell: winRateCell },
];

const REASON_COLUMNS: Column<ReasonRecord>[] = [
	{ header: "決着の理由", cell: (row) => row.reason ?? "記録なし" },
	{ header: "試合数", numeric: true, cell: (row) => formatNumber(row.matches) },
	{ header: "勝ち", numeric: true, cell: (row) => formatNumber(row.wins) },
	{ header: "負け", numeric: true, cell: (row) => formatNumber(row.losses) },
	{ header: "勝率", numeric: true, cell: winRateCell },
];

/** 試合数を棒の長さ、勝ち負けを色の割合で示す行を作る。 */
function winLossRow(
	key: string,
	label: string,
	record: FactionCombo | ReasonRecord,
	note?: string,
): BarListRow {
	return {
		key,
		label,
		note,
		values: [
			record.wins,
			record.losses,
			record.matches - record.wins - record.losses,
		],
		value: <WinLossText record={record} />,
	};
}

function FactionCard({ matches }: { matches: readonly LorMatch[] }) {
	const { combos, series, rows } = useMemo(() => {
		const combos = factionCombos(matches);
		const series = outcomeSeries(
			combos.some((combo) => combo.matches > combo.wins + combo.losses),
		);
		const rows = combos.map((combo) =>
			winLossRow(combo.key || "none", comboLabel(combo), combo),
		);
		return { combos, series, rows };
	}, [matches]);

	if (combos.length === 0) {
		return null;
	}
	return (
		<ChartCard
			title="デッキの地域"
			description="使ったデッキの地域の組み合わせごとに、練習を除いた試合を数えています。カードの構成は、Riot の開示データに含まれません。"
			legend={<SeriesLegend items={series} />}
			chart={
				<BarList
					series={series}
					rows={rows}
					label="デッキの地域ごとの試合数と勝敗"
				/>
			}
			table={
				<DataTable
					caption="デッキの地域"
					columns={COMBO_COLUMNS}
					rows={combos}
					rowKey={(row) => row.key || "none"}
				/>
			}
		/>
	);
}

function TurnCard({ matches }: { matches: readonly LorMatch[] }) {
	const { bins, series, buckets } = useMemo(() => {
		const bins = turnHistogram(matches);
		const withOthers = bins.some((bin) => bin.others > 0);
		const series = outcomeSeries(withOthers);
		const buckets: BarBucket[] = bins.map((bin) => ({
			key: bin.from,
			label: `${binLabel(bin)} ターン`,
			shortLabel: bin.to === null ? `${bin.from}+` : String(bin.from),
			values: withOthers
				? [bin.wins, bin.losses, bin.others]
				: [bin.wins, bin.losses],
		}));
		return { bins, series, buckets };
	}, [matches]);

	if (bins.length === 0) {
		return null;
	}
	const columns: Column<BarBucket>[] = [
		{ header: "ターン数", cell: (row) => row.label },
		...series.map((item, index) => ({
			header: item.label,
			numeric: true,
			cell: (row: BarBucket) => formatNumber(row.values[index] ?? 0),
		})),
	];
	return (
		<ChartCard
			title="ターン数の分布"
			description="決着までのターン数を 5 ターンごとに区切り、練習を除いた試合を数えています。"
			legend={<SeriesLegend items={series} />}
			chart={
				<StackedBars
					series={series}
					buckets={buckets}
					unit="試合"
					label="ターン数の分布。棒を選ぶと、その区切りの値を確かめられます。"
				/>
			}
			table={
				<DataTable
					caption="ターン数の分布"
					columns={columns}
					rows={buckets}
					rowKey={(row) => row.key}
				/>
			}
		/>
	);
}

function ReasonCard({ matches }: { matches: readonly LorMatch[] }) {
	const { reasons, series, rows } = useMemo(() => {
		const reasons = outcomeReasons(matches);
		const series = outcomeSeries(
			reasons.some((reason) => reason.matches > reason.wins + reason.losses),
		);
		const rows = reasons.map((record) =>
			winLossRow(
				record.reason ?? "none",
				record.reason ?? "記録なし",
				record,
				record.reason === null
					? undefined
					: REASON_NOTES[record.reason.toLowerCase()],
			),
		);
		return { reasons, series, rows };
	}, [matches]);

	if (reasons.length === 0) {
		return null;
	}
	return (
		<ChartCard
			title="決着の理由"
			description="試合がどう終わったかを、練習を除いた試合で数えています。どちらが降参や切断をしたかは、勝敗から読み取ります。"
			legend={<SeriesLegend items={series} />}
			chart={
				<BarList
					series={series}
					rows={rows}
					label="決着の理由ごとの試合数と勝敗"
				/>
			}
			table={
				<DataTable
					caption="決着の理由"
					columns={REASON_COLUMNS}
					rows={reasons}
					rowKey={(row) => row.reason ?? "none"}
				/>
			}
		/>
	);
}

/** Legends of Runeterra の画面。試合履歴と、ゲーム内での購入を示す。 */
export function LorPage() {
	const { dataset, period, toLocal } = useDashboard();

	const matches = useMemo(
		() => matchesOf(dataset, "lor", period, toLocal),
		[dataset, period, toLocal],
	);
	const summary = useMemo(() => matchSummary(matches), [matches]);
	const turns = useMemo(() => medianTurns(matches), [matches]);
	const transactions = useMemo(
		() => transactionsInPeriod(transactionsOf(dataset, "lor"), period, toLocal),
		[dataset, period, toLocal],
	);

	return (
		<GamePage
			title="Legends of Runeterra"
			lead="試合履歴と、ゲーム内での購入の記録です。"
			empty={matches.length === 0 && transactions.length === 0}
		>
			{matches.length > 0 && (
				<>
					<MatchTiles summary={summary}>
						{turns !== null && (
							<StatTile
								label="決着までのターン数"
								value={formatNumber(turns)}
								unit="ターン"
								note="練習を除いた中央値"
							/>
						)}
					</MatchTiles>
					<MatchTrendCard matches={matches} />
					<QueueRecordCard
						matches={matches}
						description="棒の長さは試合数、色の割合は勝ち負けを表します。チュートリアルと対 AI 戦は練習として扱い、勝率に数えていません。"
					/>
					<FactionCard matches={matches} />
					<TurnCard matches={matches} />
					<ReasonCard matches={matches} />
				</>
			)}
			<PurchaseListCard
				transactions={transactions}
				description="コインやワイルドカードなどで手に入れたカードです。現金での支払いは含みません。"
			/>
		</GamePage>
	);
}
