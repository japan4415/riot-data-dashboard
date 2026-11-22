import { Fragment, useMemo, useState } from "react";
import { startOfMonth, startOfYear } from "../../analysis/localTime.ts";
import { periodLabel } from "../../analysis/period.ts";
import {
	type CumulativePoint,
	cumulativeSpending,
	paymentsInPeriod,
	paymentsOf,
	spendingBuckets,
	spendingByGame,
	spendingTotals,
} from "../../analysis/spending.ts";
import { useDashboard } from "../../app/DashboardContext.tsx";
import { ChartCard } from "../../components/ChartCard.tsx";
import {
	TooltipRow,
	TooltipTitle,
} from "../../components/charts/ChartTooltip.tsx";
import { SeriesLegend } from "../../components/charts/Legend.tsx";
import {
	type BarBucket,
	StackedBars,
} from "../../components/charts/StackedBars.tsx";
import {
	type AxisTick,
	StepLineChart,
} from "../../components/charts/StepLineChart.tsx";
import { type Column, DataTable } from "../../components/DataTable.tsx";
import { EmptyState } from "../../components/EmptyState.tsx";
import { InlineFacts } from "../../components/InlineFacts.tsx";
import { ListCard } from "../../components/ListCard.tsx";
import { PageHeading } from "../../components/PageHeading.tsx";
import { SelectField } from "../../components/SelectField.tsx";
import { StatRow, StatTile } from "../../components/StatTile.tsx";
import {
	formatDateTime,
	formatMoney,
	formatNumber,
} from "../../labels/format.ts";
import {
	GAME_COLORS,
	GAME_SERIES_ORDER,
	GAMES,
	gameLabel,
} from "../../labels/games.ts";
import type { GameId, Payment } from "../../model/types.ts";
import pageStyles from "../Page.module.css";

interface CurrencyProps {
	currency: string;
	/** すべての期間の支払い。古い順。 */
	all: readonly Payment[];
	/** 期間内の支払い。古い順。 */
	payments: readonly Payment[];
}

/** 年（月）ごとの課金額。ゲームごとに積む。通貨が違う金額は足せないので、通貨ごとに図を分ける。 */
function SpendingTrendCard({ currency, payments }: Omit<CurrencyProps, "all">) {
	const { period, toLocal } = useDashboard();

	const { series, buckets } = useMemo(() => {
		const raw = spendingBuckets(payments, currency, period, toLocal);
		// 支払いが無いゲームは、凡例にも棒にも出さない。色はゲームに固定なので、残りの色は変わらない
		const games = GAME_SERIES_ORDER.filter((game) =>
			raw.some((bucket) => (bucket.amounts[game] ?? 0) > 0),
		);
		const series = games.map((game) => ({
			id: game,
			label: gameLabel(game),
			color: GAME_COLORS[game],
		}));
		const buckets: BarBucket[] = raw.map((bucket) => ({
			key: bucket.key,
			label: period.kind === "all" ? `${bucket.key}年` : `${bucket.key}月`,
			shortLabel:
				period.kind === "all"
					? `'${String(bucket.key % 100).padStart(2, "0")}`
					: String(bucket.key),
			// 図の目盛りは通貨の単位で刻むので、100 倍する前の金額に戻す
			values: games.map((game) => (bucket.amounts[game] ?? 0) / 100),
		}));
		return { series, buckets };
	}, [payments, currency, period, toLocal]);

	if (series.length === 0) {
		return null;
	}

	const money = (value: number) =>
		formatMoney({ currency, amountX100: Math.round(value * 100) });
	const title = `${period.kind === "all" ? "年" : "月"}ごとの課金額（${currency}）`;
	const columns: Column<BarBucket>[] = [
		{ header: period.kind === "all" ? "年" : "月", cell: (row) => row.label },
		...series.map((item, index) => ({
			header: item.label,
			numeric: true,
			cell: (row: BarBucket) => money(row.values[index] ?? 0),
		})),
		{
			header: "合計",
			numeric: true,
			cell: (row) => money(row.values.reduce((sum, value) => sum + value, 0)),
		},
	];

	return (
		<ChartCard
			title={title}
			description="現金での支払いを、ゲームごとに積み上げています。"
			legend={series.length > 1 ? <SeriesLegend items={series} /> : undefined}
			chart={
				<StackedBars
					series={series}
					buckets={buckets}
					unit={currency}
					formatValue={money}
					label={`${title}。棒を選ぶと、その期間の金額を確かめられます。`}
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

type CumulativeChartPoint = CumulativePoint & { x: number; y: number };

/** 記録の最初からの累計。支払いのたびに段が上がる。 */
function CumulativeCard({ currency, all }: Omit<CurrencyProps, "payments">) {
	const { period, toLocal, lastRecordAt } = useDashboard();

	const { points, opening, xDomain, xTicks } = useMemo(() => {
		const series = cumulativeSpending(all, currency, period, toLocal);
		const points: CumulativeChartPoint[] = series.points.map((point) => ({
			...point,
			x: point.at,
			y: point.amountX100 / 100,
		}));
		const first = points[0]?.at ?? lastRecordAt ?? 0;
		const last = points.at(-1)?.at ?? first;
		// 累計は次の支払いまで変わらないので、線は記録の終わりまで延ばす
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
				xTicks.push({ value: startOfYear(year, toLocal), label: `${year}年` });
			}
		}
		return { points, opening: series.opening / 100, xDomain, xTicks };
	}, [all, currency, period, toLocal, lastRecordAt]);

	if (points.length === 0 && opening === 0) {
		return null;
	}

	const title = `累計の課金額（${currency}）`;
	const money = (amountX100: number) => formatMoney({ currency, amountX100 });
	const columns: Column<CumulativeChartPoint>[] = [
		{ header: "日時", cell: (row) => formatDateTime(row.at, toLocal) },
		{
			header: "その時点までの累計",
			numeric: true,
			cell: (row) => money(row.amountX100),
		},
	];

	return (
		<ChartCard
			title={title}
			description={
				period.kind === "all"
					? "記録の最初からの累計です。支払いのたびに段が上がります。"
					: `記録の最初からの累計です。${periodLabel(period)}より前の分を含みます。`
			}
			chart={
				<StepLineChart
					points={points}
					xDomain={xDomain}
					xTicks={xTicks}
					// 期間が始まる前の累計が 0 のときは、最初の支払いから線を引く
					opening={period.kind === "year" ? opening : null}
					extend
					leftMargin={64}
					label={`${title}の推移。`}
					tooltip={(point) => (
						<>
							<TooltipTitle>{formatDateTime(point.at, toLocal)}</TooltipTitle>
							<TooltipRow label="累計" value={money(point.amountX100)} />
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
					empty="この期間に、支払いの記録はありません。"
				/>
			}
		/>
	);
}

type GameFilter = GameId | "all";

function PaymentListCard({ payments }: { payments: readonly Payment[] }) {
	const { toLocal } = useDashboard();
	const [filter, setFilter] = useState<GameFilter>("all");

	const { all, keys, games, byGame } = useMemo(() => {
		const all = [...payments].reverse();
		const present = new Set(all.map((payment) => payment.game));
		return {
			all,
			// 購入 ID が無い行がありうるので、並び順を行の識別に使う
			keys: new Map(all.map((row, index) => [row, index])),
			games: GAMES.filter((game) => present.has(game)),
			byGame: spendingByGame(all, GAMES),
		};
	}, [payments]);
	// 期間を変えて、選んでいたゲームの支払いが無くなったら、絞り込みを外す
	const active = filter !== "all" && games.includes(filter) ? filter : "all";
	const rows = useMemo(
		() => (active === "all" ? all : all.filter((row) => row.game === active)),
		[all, active],
	);

	const columns = useMemo<Column<Payment>[]>(
		() => [
			{ header: "日時", cell: (row) => formatDateTime(row.at, toLocal) },
			{ header: "ゲーム", cell: (row) => gameLabel(row.game) },
			{ header: "金額", numeric: true, cell: (row) => formatMoney(row) },
			{ header: "決済手段", cell: (row) => row.method ?? "—" },
			{
				header: "付与された通貨",
				numeric: true,
				cell: (row) =>
					row.granted === null
						? "—"
						: `${formatNumber(row.granted.amount)} ${row.granted.currency}`,
			},
		],
		[toLocal],
	);

	return (
		<ListCard
			title="支払いの一覧"
			description="現金での支払いを、新しい順に並べています。決済手段は、データに入っている表記のままです。LoL の支払いには、付与された RP の量の記録がありません。"
			controls={
				games.length > 1 ? (
					<SelectField<GameFilter>
						label="ゲーム"
						value={active}
						onChange={setFilter}
						options={[
							{ value: "all", label: `すべて（${formatNumber(all.length)}）` },
							...games.map((game) => ({
								value: game,
								label: gameLabel(game),
							})),
						]}
					/>
				) : undefined
			}
			summary={
				<InlineFacts
					items={byGame.map((entry) => ({
						label: `${gameLabel(entry.game)}（${entry.currency}）`,
						value: (
							<>
								<strong>{formatMoney(entry)}</strong>（
								{formatNumber(entry.count)} 回）
							</>
						),
					}))}
				/>
			}
			columns={columns}
			rows={rows}
			rowKey={(row) => keys.get(row) ?? row.at}
			empty="この期間に、支払いの記録はありません。"
		/>
	);
}

/** 課金の画面。現金での支払いを、通貨ごとに分けて示す。 */
export function SpendingPage() {
	const { dataset, period, toLocal } = useDashboard();

	const all = useMemo(() => paymentsOf(dataset), [dataset]);
	const payments = useMemo(
		() => paymentsInPeriod(all, period, toLocal),
		[all, period, toLocal],
	);
	const totals = useMemo(() => spendingTotals(payments), [payments]);
	// 図は、期間内に支払いが無い通貨でも、それまでの累計があれば出す
	const currencies = useMemo(
		() => spendingTotals(all).map((total) => total.currency),
		[all],
	);

	return (
		<div className={pageStyles.page}>
			<PageHeading title="課金">
				現金での支払いの記録です。通貨が違う金額は換算せず、通貨ごとに分けて示します。ゲーム内通貨での購入は、それぞれのゲームの画面にあります。
				{period.kind === "year" &&
					`${periodLabel(period)}の分を表示しています。`}
			</PageHeading>

			{all.length === 0 ? (
				<EmptyState>支払いの記録がありません。</EmptyState>
			) : (
				<>
					{payments.length === 0 ? (
						<EmptyState>
							{periodLabel(period)}に、支払いの記録はありません。
						</EmptyState>
					) : (
						<StatRow>
							{totals.map((total) => (
								<StatTile
									key={total.currency}
									label={`課金額（${total.currency}）`}
									value={formatMoney(total)}
									note={`${formatNumber(total.count)} 回`}
								/>
							))}
							<StatTile
								label="支払いの回数"
								value={formatNumber(payments.length)}
								unit="回"
							/>
						</StatRow>
					)}

					{/* 通貨ごとに、期間別の図と累計の図を続けて並べる */}
					{currencies.map((currency) => (
						<Fragment key={currency}>
							<SpendingTrendCard currency={currency} payments={payments} />
							<CumulativeCard currency={currency} all={all} />
						</Fragment>
					))}
					{payments.length > 0 && <PaymentListCard payments={payments} />}
				</>
			)}
		</div>
	);
}
