import type { Dataset, EpochMs, GameId, Payment } from "../model/types.ts";
import { browserLocal, type ToLocal } from "./localTime.ts";
import { inPeriod, type Period } from "./period.ts";
import { extent } from "./stats.ts";

/** 現金での支払いを、古い順に返す。 */
export function paymentsOf(dataset: Dataset): Payment[] {
	return [...dataset.payments].sort((a, b) => a.at - b.at);
}

export function paymentsInPeriod(
	payments: readonly Payment[],
	period: Period,
	toLocal: ToLocal = browserLocal,
): Payment[] {
	return period.kind === "all"
		? [...payments]
		: payments.filter((payment) => inPeriod(period, toLocal(payment.at).year));
}

export interface SpendingTotal {
	/** 通貨コード。例: `JPY` */
	currency: string;
	/** 金額を 100 倍した整数。 */
	amountX100: number;
	/** 支払いの回数。 */
	count: number;
}

/** 通貨ごとの合計。通貨コードの順に並べる。通貨の換算はしない。 */
export function spendingTotals(payments: readonly Payment[]): SpendingTotal[] {
	const totals = new Map<string, SpendingTotal>();
	for (const payment of payments) {
		let total = totals.get(payment.currency);
		if (!total) {
			total = { currency: payment.currency, amountX100: 0, count: 0 };
			totals.set(payment.currency, total);
		}
		total.amountX100 += payment.amountX100;
		total.count += 1;
	}
	return [...totals.values()].sort((a, b) =>
		a.currency.localeCompare(b.currency),
	);
}

export interface GameSpending extends SpendingTotal {
	game: GameId;
}

/** ゲームと通貨の組ごとの合計。`games` の順、通貨コードの順に並べる。 */
export function spendingByGame(
	payments: readonly Payment[],
	games: readonly GameId[],
): GameSpending[] {
	const totals = new Map<string, GameSpending>();
	for (const payment of payments) {
		const key = `${payment.game}:${payment.currency}`;
		let total = totals.get(key);
		if (!total) {
			total = {
				game: payment.game,
				currency: payment.currency,
				amountX100: 0,
				count: 0,
			};
			totals.set(key, total);
		}
		total.amountX100 += payment.amountX100;
		total.count += 1;
	}
	return [...totals.values()].sort(
		(a, b) =>
			games.indexOf(a.game) - games.indexOf(b.game) ||
			a.currency.localeCompare(b.currency),
	);
}

export interface SpendingBucket {
	/** 全期間では年、1 年分では月（1〜12）。 */
	key: number;
	/** ゲームごとの金額（100 倍した整数）。支払いが無いゲームは含まない。 */
	amounts: Partial<Record<GameId, number>>;
}

/**
 * 1 つの通貨の支払いを、時間の区切りとゲームごとにまとめる。
 *
 * 全期間なら、最初の支払いの年から最後の支払いの年までを年ごとに区切る。
 * 1 年分なら月ごとに区切る。支払いが無い区切りも含める。
 * `payments` は、期間で絞り込んだものを渡すこと。
 */
export function spendingBuckets(
	payments: readonly Payment[],
	currency: string,
	period: Period,
	toLocal: ToLocal = browserLocal,
): SpendingBucket[] {
	const rows = payments
		.filter((payment) => payment.currency === currency)
		.map((payment) => ({ payment, local: toLocal(payment.at) }));

	const keys: number[] = [];
	if (period.kind === "year") {
		for (let month = 1; month <= 12; month += 1) {
			keys.push(month);
		}
	} else {
		const years = extent(rows.map((row) => row.local.year));
		if (years) {
			for (let year = years.min; year <= years.max; year += 1) {
				keys.push(year);
			}
		}
	}

	const buckets = new Map<number, SpendingBucket>(
		keys.map((key) => [key, { key, amounts: {} }]),
	);
	for (const { payment, local } of rows) {
		const bucket = buckets.get(
			period.kind === "all" ? local.year : local.month,
		);
		if (bucket) {
			bucket.amounts[payment.game] =
				(bucket.amounts[payment.game] ?? 0) + payment.amountX100;
		}
	}
	return [...buckets.values()];
}

export interface CumulativePoint {
	at: EpochMs;
	/** その支払いまでの累計（100 倍した整数）。 */
	amountX100: number;
}

export interface CumulativeSpending {
	/** 期間内の支払いごとの累計。古い順。同じ時刻の支払いは 1 点にまとめる。 */
	points: CumulativePoint[];
	/** 期間が始まる前までの累計。全期間のときは 0。 */
	opening: number;
}

/**
 * 1 つの通貨の、記録の最初からの累計。`payments` は、すべての期間の支払いを
 * 古い順に並べたものを渡すこと。
 */
export function cumulativeSpending(
	payments: readonly Payment[],
	currency: string,
	period: Period,
	toLocal: ToLocal = browserLocal,
): CumulativeSpending {
	const points: CumulativePoint[] = [];
	let opening = 0;
	let total = 0;
	for (const payment of payments) {
		if (payment.currency !== currency) {
			continue;
		}
		total += payment.amountX100;
		const year = toLocal(payment.at).year;
		if (period.kind === "year" && year < period.year) {
			opening = total;
			continue;
		}
		if (!inPeriod(period, year)) {
			continue;
		}
		const last = points.at(-1);
		if (last && last.at === payment.at) {
			last.amountX100 = total;
		} else {
			points.push({ at: payment.at, amountX100: total });
		}
	}
	return { points, opening };
}
