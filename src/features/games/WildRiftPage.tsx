import { useMemo, useState } from "react";
import { matchesOf, matchSummary } from "../../analysis/matches.ts";
import { extent } from "../../analysis/stats.ts";
import { transactionsInPeriod, transactionsOf } from "../../analysis/store.ts";
import {
	DIVISIONS_PER_TIER,
	highestRank,
	inventoryCounts,
	RANK_TIERS,
	type RankPoint,
	rankHistory,
} from "../../analysis/wildrift.ts";
import { useDashboard } from "../../app/DashboardContext.tsx";
import { ChartCard } from "../../components/ChartCard.tsx";
import {
	TooltipRow,
	TooltipTitle,
} from "../../components/charts/ChartTooltip.tsx";
import {
	type AxisTick,
	StepLineChart,
} from "../../components/charts/StepLineChart.tsx";
import { type Column, DataTable } from "../../components/DataTable.tsx";
import { InlineFacts } from "../../components/InlineFacts.tsx";
import { ListCard } from "../../components/ListCard.tsx";
import { SelectField } from "../../components/SelectField.tsx";
import { StatTile } from "../../components/StatTile.tsx";
import { formatDate, formatNumber } from "../../labels/format.ts";
import { INVENTORY_CATEGORY_LABELS } from "../../labels/store.ts";
import type {
	InventoryCategory,
	InventoryItem,
	Outcome,
	WildRiftMatch,
} from "../../model/types.ts";
import { GamePage } from "./GamePage.tsx";
import { MatchTiles } from "./MatchTiles.tsx";
import { MatchTrendCard } from "./MatchTrendCard.tsx";
import { PurchaseListCard } from "./PurchaseListCard.tsx";
import { QueueRecordCard } from "./QueueRecordCard.tsx";

const OUTCOME_LABELS: Readonly<Record<Outcome, string>> = {
	win: "勝ち",
	loss: "負け",
	none: "勝敗なし",
};

type RankChartPoint = RankPoint & { x: number; y: number };

function RankCard({ matches }: { matches: readonly WildRiftMatch[] }) {
	const { period, toLocal } = useDashboard();

	const { points, unreadable, xDomain, yDomain, yTicks, xTicks } =
		useMemo(() => {
			const history = rankHistory(matches);
			const points: RankChartPoint[] = history.points.map((point) => ({
				...point,
				x: point.index,
				y: point.ordinal,
			}));

			// 縦軸は、記録があるティアの下端から上端までにする
			const range = extent(points.map((point) => point.ordinal)) ?? {
				min: 0,
				max: 0,
			};
			const bottom =
				Math.floor(range.min / DIVISIONS_PER_TIER) * DIVISIONS_PER_TIER;
			const top =
				(Math.floor(range.max / DIVISIONS_PER_TIER) + 1) * DIVISIONS_PER_TIER;
			const yTicks: AxisTick[] = [];
			for (let value = bottom; value <= top; value += DIVISIONS_PER_TIER) {
				yTicks.push({
					value,
					label: RANK_TIERS[value / DIVISIONS_PER_TIER] ?? "",
				});
			}

			// 横軸は試合の順なので、年（1 年分では月）が変わる最初の試合に名前を付ける
			const xTicks: AxisTick[] = [];
			let previous: number | null = null;
			for (const point of points) {
				const local = toLocal(point.at);
				const key = period.kind === "all" ? local.year : local.month;
				if (key !== previous) {
					previous = key;
					xTicks.push({
						value: point.index,
						label: period.kind === "all" ? `${key}年` : `${key}月`,
					});
				}
			}

			return {
				points,
				unreadable: history.unreadable,
				// 1 試合だけのときも幅を持たせる
				xDomain: [0, Math.max(1, points.length - 1)] as const,
				yDomain: [bottom, top] as const,
				yTicks,
				xTicks,
			};
		}, [matches, period, toLocal]);

	if (points.length === 0) {
		return null;
	}

	const columns: Column<RankChartPoint>[] = [
		{ header: "試合", cell: (row) => `${formatNumber(row.index + 1)} 試合目` },
		{ header: "日付", cell: (row) => formatDate(row.at, toLocal) },
		{ header: "ランク", cell: (row) => row.rank },
		{ header: "勝敗", cell: (row) => OUTCOME_LABELS[row.outcome] },
	];

	return (
		<ChartCard
			title="ランクの推移"
			description={
				<>
					ランクの記録がある試合を古い順に並べ、その時点のランクを示しています。横線は、各ティアのもっとも下の段階（IV）の高さです。横軸は試合の順で、日付の間隔とは一致しません。
					{unreadable > 0 &&
						`ランクの表記を読めなかった ${formatNumber(unreadable)} 試合は、含めていません。`}
				</>
			}
			chart={
				<StepLineChart
					points={points}
					xDomain={xDomain}
					xTicks={xTicks}
					yDomain={yDomain}
					yTicks={yTicks}
					leftMargin={84}
					label="試合ごとのランクの推移。"
					tooltip={(point) => (
						<>
							<TooltipTitle>
								{formatDate(point.at, toLocal)}・{formatNumber(point.index + 1)}{" "}
								試合目
							</TooltipTitle>
							<TooltipRow label="ランク" value={point.rank} />
							<TooltipRow
								label="この試合"
								value={OUTCOME_LABELS[point.outcome]}
							/>
						</>
					)}
				/>
			}
			table={
				<DataTable
					caption="ランクの推移"
					columns={columns}
					rows={points}
					rowKey={(row) => row.index}
				/>
			}
		/>
	);
}

const INVENTORY_COLUMNS: Column<InventoryItem>[] = [
	{ header: "名前", cell: (row) => row.name },
	{ header: "分類", cell: (row) => INVENTORY_CATEGORY_LABELS[row.category] },
	{ header: "スキンの対象", cell: (row) => row.detail ?? "—" },
	{
		header: "数",
		numeric: true,
		cell: (row) => (row.quantity === null ? "—" : formatNumber(row.quantity)),
	},
];

type InventoryFilter = InventoryCategory | "all";

function InventoryCard() {
	const { dataset } = useDashboard();
	const [filter, setFilter] = useState<InventoryFilter>("all");

	const { inventory, counts, keys } = useMemo(() => {
		const inventory = dataset.inventory.filter(
			(item) => item.game === "wildrift",
		);
		return {
			inventory,
			counts: inventoryCounts(inventory),
			keys: new Map(inventory.map((item, index) => [item, index])),
		};
	}, [dataset]);
	const balances = useMemo(
		() => dataset.balances.filter((balance) => balance.game === "wildrift"),
		[dataset],
	);
	const rows = useMemo(
		() =>
			filter === "all"
				? inventory
				: inventory.filter((item) => item.category === filter),
		[inventory, filter],
	);

	if (inventory.length === 0 && balances.length === 0) {
		return null;
	}

	return (
		<ListCard
			title="所持品の一覧"
			description="開示データが作られた時点の所持品と、通貨の残高です。期間の絞り込みは適用されません。名前は、データに入っている英語表記のままです。"
			controls={
				counts.length > 1 ? (
					<SelectField<InventoryFilter>
						label="分類"
						value={filter}
						onChange={setFilter}
						options={[
							{
								value: "all",
								label: `すべて（${formatNumber(inventory.length)}）`,
							},
							...counts.map((entry) => ({
								value: entry.category,
								label: `${INVENTORY_CATEGORY_LABELS[entry.category]}（${formatNumber(entry.count)}）`,
							})),
						]}
					/>
				) : undefined
			}
			summary={
				balances.length > 0 ? (
					<InlineFacts
						items={balances.map((balance) => ({
							label: balance.currency,
							value: <strong>{formatNumber(balance.amount)}</strong>,
						}))}
					/>
				) : undefined
			}
			columns={INVENTORY_COLUMNS}
			rows={rows}
			rowKey={(row) => keys.get(row) ?? row.name}
			empty="所持品の記録はありません。"
		/>
	);
}

/** Wild Rift の画面。試合履歴、ランクの推移、所持品を示す。 */
export function WildRiftPage() {
	const { dataset, period, toLocal } = useDashboard();

	const matches = useMemo(
		() => matchesOf(dataset, "wildrift", period, toLocal),
		[dataset, period, toLocal],
	);
	const summary = useMemo(() => matchSummary(matches), [matches]);
	const best = useMemo(
		() => highestRank(rankHistory(matches).points),
		[matches],
	);
	const transactions = useMemo(
		() =>
			transactionsInPeriod(
				transactionsOf(dataset, "wildrift"),
				period,
				toLocal,
			),
		[dataset, period, toLocal],
	);
	const hasSnapshot = useMemo(
		() =>
			dataset.inventory.some((item) => item.game === "wildrift") ||
			dataset.balances.some((balance) => balance.game === "wildrift"),
		[dataset],
	);

	return (
		<GamePage
			title="Wild Rift"
			lead="試合履歴、ランクの推移、所持品の記録です。使ったチャンピオンやスコアなどの試合の内容は、Riot の開示データに含まれません。"
			empty={matches.length === 0 && transactions.length === 0 && !hasSnapshot}
		>
			{matches.length > 0 && (
				<>
					<MatchTiles summary={summary}>
						{best && (
							<StatTile
								label="最高ランク"
								value={best.rank}
								note={`${formatDate(best.at, toLocal)}に到達`}
							/>
						)}
					</MatchTiles>
					<MatchTrendCard matches={matches} />
					<QueueRecordCard
						matches={matches}
						description="棒の長さは試合数、色の割合は勝ち負けを表します。チュートリアルと対 AI 戦は練習として扱い、勝率に数えていません。勝敗が付かない種別（Duel など）も数えていません。"
					/>
					<RankCard matches={matches} />
				</>
			)}
			{(transactions.length > 0 || matches.length > 0) && (
				<PurchaseListCard
					transactions={transactions}
					description="ブルーモートなどのゲーム内通貨で購入したものです。現金での支払いは含みません。"
				/>
			)}
			<InventoryCard />
		</GamePage>
	);
}
