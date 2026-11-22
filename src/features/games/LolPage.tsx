import { useMemo, useState } from "react";
import { startOfMonth, startOfYear } from "../../analysis/localTime.ts";
import {
	type BalancePoint,
	balanceSeries,
	type CategoryPurchases,
	type Gift,
	giftsInPeriod,
	PAID_WITH,
	purchasesByCategory,
	storeSummary,
	transactionsInPeriod,
	transactionsOf,
} from "../../analysis/store.ts";
import { useDashboard } from "../../app/DashboardContext.tsx";
import { ChartCard } from "../../components/ChartCard.tsx";
import { BarList, type BarListRow } from "../../components/charts/BarList.tsx";
import {
	TooltipRow,
	TooltipTitle,
} from "../../components/charts/ChartTooltip.tsx";
import { SeriesLegend } from "../../components/charts/Legend.tsx";
import {
	type AxisTick,
	StepLineChart,
} from "../../components/charts/StepLineChart.tsx";
import { type Column, DataTable } from "../../components/DataTable.tsx";
import { InlineFacts } from "../../components/InlineFacts.tsx";
import { ListCard } from "../../components/ListCard.tsx";
import { SelectField } from "../../components/SelectField.tsx";
import { StatRow, StatTile } from "../../components/StatTile.tsx";
import {
	formatDateTime,
	formatNumber,
	formatSigned,
} from "../../labels/format.ts";
import {
	currencyLabel,
	formatDeltas,
	GIFT_DIRECTION_LABELS,
	lolItemCategoryLabel,
	PAID_WITH_COLORS,
	PAID_WITH_LABELS,
	TRANSACTION_KIND_LABELS,
	TRANSACTION_KINDS,
} from "../../labels/store.ts";
import type { Transaction, TransactionKind } from "../../model/types.ts";
import { GamePage } from "./GamePage.tsx";

type BalanceChartPoint = BalancePoint & { x: number; y: number };

interface BalanceCardProps {
	/** すべての期間の取引。古い順。 */
	transactions: readonly Transaction[];
	currency: "RP" | "BE";
}

/** 取引後の残高の推移。通貨ごとに桁が違うので、図を分けて描く。 */
function BalanceCard({ transactions, currency }: BalanceCardProps) {
	const { period, toLocal, lastRecordAt } = useDashboard();
	const name = currencyLabel(currency);

	const { points, opening, xDomain, xTicks } = useMemo(() => {
		const series = balanceSeries(transactions, currency, period, toLocal);
		const points: BalanceChartPoint[] = series.points.map((point) => ({
			...point,
			x: point.at,
			y: point.amount,
		}));
		const first = points[0]?.at ?? lastRecordAt ?? 0;
		const last = points.at(-1)?.at ?? first;
		// 残高は次の取引まで変わらないので、線は記録の終わりまで延ばす
		const recordEnd = Math.max(last, lastRecordAt ?? last);

		const xTicks: AxisTick[] = [];
		let xDomain: readonly [number, number];
		if (period.kind === "year") {
			const start = startOfYear(period.year, toLocal);
			const end = Math.min(startOfYear(period.year + 1, toLocal), recordEnd);
			xDomain = [start, Math.max(end, start + 1)];
			for (let month = 1; month <= 12; month += 1) {
				xTicks.push({
					value: startOfMonth(period.year, month, toLocal),
					label: `${month}月`,
				});
			}
		} else {
			xDomain = [first, Math.max(recordEnd, first + 1)];
			const lastYear = toLocal(recordEnd).year;
			for (let year = toLocal(first).year + 1; year <= lastYear; year += 1) {
				xTicks.push({
					value: startOfYear(year, toLocal),
					label: `${year}年`,
				});
			}
		}
		return { points, opening: series.opening, xDomain, xTicks };
	}, [transactions, currency, period, toLocal, lastRecordAt]);

	if (points.length === 0 && opening === null) {
		return null;
	}

	// 英字の名前と日本語の間には、ほかの文言と同じく空白を入れる
	const title = currency === "RP" ? "RP の残高" : `${name}の残高`;
	const columns: Column<BalanceChartPoint>[] = [
		{ header: "日時", cell: (row) => formatDateTime(row.at, toLocal) },
		{
			header: `取引後の残高（${currency}）`,
			numeric: true,
			cell: (row) => formatNumber(row.amount),
		},
	];

	return (
		<ChartCard
			title={title}
			description={
				currency === "BE"
					? "取引のたびに記録された、取引後の残高です。試合などで得た分は、次の取引の時点でまとめて現れます。"
					: "取引のたびに記録された、取引後の残高です。"
			}
			chart={
				<StepLineChart
					points={points}
					xDomain={xDomain}
					xTicks={xTicks}
					opening={opening}
					extend
					leftMargin={64}
					label={`${title}の推移。`}
					tooltip={(point) => (
						<>
							<TooltipTitle>{formatDateTime(point.at, toLocal)}</TooltipTitle>
							<TooltipRow
								label="取引後の残高"
								value={`${formatNumber(point.amount)} ${currency}`}
							/>
						</>
					)}
				/>
			}
			table={
				<DataTable
					caption={title}
					columns={columns}
					rows={points}
					rowKey={(row) => row.at}
					empty="この期間に、取引の記録はありません。"
				/>
			}
		/>
	);
}

const CATEGORY_COLUMNS: Column<CategoryPurchases>[] = [
	{ header: "区分", cell: (row) => lolItemCategoryLabel(row.category) },
	...PAID_WITH.map((paid) => ({
		header: PAID_WITH_LABELS[paid],
		numeric: true,
		cell: (row: CategoryPurchases) => formatNumber(row.counts[paid]),
	})),
	{ header: "合計", numeric: true, cell: (row) => formatNumber(row.total) },
];

function CategoryCard({
	transactions,
}: {
	transactions: readonly Transaction[];
}) {
	const { categories, series, rows } = useMemo(() => {
		const categories = purchasesByCategory(transactions);
		// 期間内に 1 件も無い支払い方は、凡例にも棒にも出さない。色は支払い方に固定なので、残りの色は変わらない
		const paid = PAID_WITH.filter((key) =>
			categories.some((category) => category.counts[key] > 0),
		);
		const series = paid.map((key) => ({
			id: key,
			label: PAID_WITH_LABELS[key],
			color: PAID_WITH_COLORS[key],
		}));
		const rows: BarListRow[] = categories.map((category) => ({
			key: category.category ?? "unknown",
			label: lolItemCategoryLabel(category.category),
			values: paid.map((key) => category.counts[key]),
			value: (
				<>
					<strong>{formatNumber(category.total)}</strong> 件
				</>
			),
		}));
		return { categories, series, rows };
	}, [transactions]);

	if (categories.length === 0) {
		return null;
	}
	return (
		<ChartCard
			title="購入した品目の区分"
			description="購入として記録された品目を、品目 ID から推定した区分ごとに数えています。通貨の増減が無い行は、バンドルの中身やクラフトの結果が 1 品目ずつ記録されたものと考えられます。"
			legend={<SeriesLegend items={series} />}
			chart={
				<BarList
					series={series}
					rows={rows}
					label="区分ごとの、購入した品目の数"
				/>
			}
			table={
				<DataTable
					caption="購入した品目の区分"
					columns={CATEGORY_COLUMNS}
					rows={categories}
					rowKey={(row) => row.category ?? "unknown"}
				/>
			}
		/>
	);
}

interface GiftCardProps {
	/** すべての期間の取引。古い順。 */
	transactions: readonly Transaction[];
}

function GiftCard({ transactions }: GiftCardProps) {
	const { period, toLocal } = useDashboard();
	const rows = useMemo(
		() => giftsInPeriod(transactions, period, toLocal),
		[transactions, period, toLocal],
	);

	const columns = useMemo<Column<Gift>[]>(
		() => [
			{ header: "日時", cell: (row) => formatDateTime(row.at, toLocal) },
			{ header: "向き", cell: (row) => GIFT_DIRECTION_LABELS[row.direction] },
			{
				header: "内容",
				cell: (row) =>
					row.what === "rp" ? "RP" : lolItemCategoryLabel(row.item.category),
			},
			{ header: "品目 ID", cell: (row) => row.item.rawId ?? "—" },
			{
				header: "通貨の増減",
				numeric: true,
				cell: (row) => formatDeltas(row.deltas),
			},
			{
				header: "補足",
				cell: (row) => (row.mystery ? "ミステリーギフト" : "—"),
			},
		],
		[toLocal],
	);

	if (rows.length === 0) {
		return null;
	}
	const sent = rows.filter((row) => row.direction === "sent").length;
	return (
		<ListCard
			title="贈り物の一覧"
			description="品目を贈ると、支払いの行と品目を移す行の 2 行が記録されます。同じ品目で時刻が近い 2 行は、1 件の贈り物にまとめています。贈った相手は、Riot の開示データに含まれません。"
			summary={
				<InlineFacts
					items={[
						{
							label: "贈った",
							value: <strong>{formatNumber(sent)} 件</strong>,
						},
						{
							label: "受け取った",
							value: <strong>{formatNumber(rows.length - sent)} 件</strong>,
						},
					]}
				/>
			}
			columns={columns}
			rows={rows}
			rowKey={(row) => row.key}
		/>
	);
}

type KindFilter = TransactionKind | "all";

function amountOf(
	entries: Transaction["deltas"],
	currency: string,
): number | null {
	return entries.find((entry) => entry.currency === currency)?.amount ?? null;
}

function TransactionCard({
	transactions,
}: {
	transactions: readonly Transaction[];
}) {
	const { toLocal } = useDashboard();
	const [filter, setFilter] = useState<KindFilter>("all");

	const { all, keys, kinds } = useMemo(() => {
		const all = [...transactions].reverse();
		const counts = new Map<TransactionKind, number>();
		for (const transaction of all) {
			counts.set(transaction.kind, (counts.get(transaction.kind) ?? 0) + 1);
		}
		return {
			all,
			// 同じ ID の行がありうるので、並び順を行の識別に使う
			keys: new Map(all.map((row, index) => [row, index])),
			kinds: TRANSACTION_KINDS.flatMap((kind) => {
				const count = counts.get(kind);
				return count === undefined ? [] : [{ kind, count }];
			}),
		};
	}, [transactions]);
	// 期間を変えて、選んでいた種類の取引が無くなったら、絞り込みを外す
	const active =
		filter !== "all" && kinds.some((entry) => entry.kind === filter)
			? filter
			: "all";
	// 選択そのものも外し、あとでその種類の取引がある期間に戻っても、勝手に絞り込まない
	if (active !== filter) {
		setFilter("all");
	}
	const rows = useMemo(
		() => (active === "all" ? all : all.filter((row) => row.kind === active)),
		[all, active],
	);

	const columns = useMemo<Column<Transaction>[]>(() => {
		const delta = (currency: string) => (row: Transaction) => {
			const amount = amountOf(row.deltas, currency);
			return amount === null ? "—" : formatSigned(amount);
		};
		const balance = (currency: string) => (row: Transaction) => {
			const amount = amountOf(row.balances, currency);
			return amount === null ? "—" : formatNumber(amount);
		};
		return [
			{ header: "日時", cell: (row) => formatDateTime(row.at, toLocal) },
			{
				header: "種類",
				cell: (row) =>
					row.refunded === true
						? `${TRANSACTION_KIND_LABELS[row.kind]}（返金済み）`
						: TRANSACTION_KIND_LABELS[row.kind],
			},
			{
				header: "区分",
				cell: (row) => lolItemCategoryLabel(row.item.category),
			},
			{ header: "品目 ID", cell: (row) => row.item.rawId ?? "—" },
			{ header: "RP の増減", numeric: true, cell: delta("RP") },
			{ header: "BE の増減", numeric: true, cell: delta("BE") },
			{ header: "RP の残高", numeric: true, cell: balance("RP") },
			{ header: "BE の残高", numeric: true, cell: balance("BE") },
		];
	}, [toLocal]);

	return (
		<ListCard
			title="取引の一覧"
			description="ストアでの取引を、新しい順に並べています。BE はブルーエッセンスです。品目の名前は開示データに含まれないので、品目 ID をそのまま表示しています。"
			controls={
				kinds.length > 1 ? (
					<SelectField<KindFilter>
						label="種類"
						value={active}
						onChange={setFilter}
						options={[
							{ value: "all", label: `すべて（${formatNumber(all.length)}）` },
							...kinds.map((entry) => ({
								value: entry.kind,
								label: `${TRANSACTION_KIND_LABELS[entry.kind]}（${formatNumber(entry.count)}）`,
							})),
						]}
					/>
				) : undefined
			}
			columns={columns}
			rows={rows}
			rowKey={(row) => keys.get(row) ?? row.at}
			pageSize={50}
			empty="この期間に、取引の記録はありません。"
		/>
	);
}

/** League of Legends の画面。試合履歴が無いので、ストアの取引を示す。 */
export function LolPage() {
	const { dataset, period, toLocal } = useDashboard();

	const all = useMemo(() => transactionsOf(dataset, "lol"), [dataset]);
	const transactions = useMemo(
		() => transactionsInPeriod(all, period, toLocal),
		[all, period, toLocal],
	);
	const summary = useMemo(() => storeSummary(transactions), [transactions]);

	return (
		<GamePage
			title="League of Legends"
			lead="ストアでの取引の記録です。試合履歴は、Riot の開示データに含まれません。"
			empty={transactions.length === 0}
		>
			<StatRow>
				<StatTile
					label="購入した品目"
					value={formatNumber(summary.purchases)}
					unit="件"
					note={`取引の記録は全部で ${formatNumber(summary.transactions)} 件`}
				/>
				<StatTile
					label="購入した RP"
					value={formatNumber(summary.toppedUpRp)}
					unit="RP"
					note={`${formatNumber(summary.topUps)} 回`}
				/>
				<StatTile
					label="使った RP"
					value={formatNumber(summary.spentRp)}
					unit="RP"
					note="品目の購入と贈り物"
				/>
				<StatTile
					label="使ったブルーエッセンス"
					value={formatNumber(summary.spentBe)}
					unit="BE"
				/>
			</StatRow>

			<BalanceCard transactions={all} currency="RP" />
			<BalanceCard transactions={all} currency="BE" />
			<CategoryCard transactions={transactions} />
			<GiftCard transactions={all} />
			<TransactionCard transactions={transactions} />
		</GamePage>
	);
}
