import type {
	CurrencyAmount,
	Dataset,
	EpochMs,
	GameId,
	Transaction,
	TransactionItem,
} from "../model/types.ts";
import { browserLocal, type ToLocal } from "./localTime.ts";
import { inPeriod, type Period } from "./period.ts";

/** 1 つのゲームの取引を、古い順に返す。同じ時刻の取引は、元の並びを保つ。 */
export function transactionsOf(dataset: Dataset, game: GameId): Transaction[] {
	return dataset.transactions
		.filter((transaction) => transaction.game === game)
		.sort((a, b) => a.at - b.at);
}

export function transactionsInPeriod(
	transactions: readonly Transaction[],
	period: Period,
	toLocal: ToLocal = browserLocal,
): Transaction[] {
	return period.kind === "all"
		? [...transactions]
		: transactions.filter((transaction) =>
				inPeriod(period, toLocal(transaction.at).year),
			);
}

export interface CurrencyFlow {
	currency: string;
	/** 支払った量の合計（正の数）。 */
	spent: number;
	/** 支払いをともなう取引の数。 */
	spentCount: number;
	/** 得た量の合計。 */
	gained: number;
}

/** 通貨ごとの、支払った量と得た量。支払った量が多い順に並べる。 */
export function currencyFlows(
	transactions: readonly Transaction[],
): CurrencyFlow[] {
	const flows = new Map<string, CurrencyFlow>();
	for (const transaction of transactions) {
		for (const delta of transaction.deltas) {
			let flow = flows.get(delta.currency);
			if (!flow) {
				flow = { currency: delta.currency, spent: 0, spentCount: 0, gained: 0 };
				flows.set(delta.currency, flow);
			}
			if (delta.amount < 0) {
				flow.spent -= delta.amount;
				flow.spentCount += 1;
			} else {
				flow.gained += delta.amount;
			}
		}
	}
	return [...flows.values()].sort(
		(a, b) =>
			b.spentCount - a.spentCount || a.currency.localeCompare(b.currency),
	);
}

export interface BalancePoint {
	at: EpochMs;
	amount: number;
}

export interface BalanceSeries {
	/** 期間内の、取引後の残高。古い順。同じ時刻の取引は、最後の残高だけを残す。 */
	points: BalancePoint[];
	/** 期間が始まる前の最後の残高。全期間のとき、または前の記録が無いときは null。 */
	opening: number | null;
}

/**
 * 取引後の残高を時系列に並べる。`transactions` は古い順に並んでいること。
 */
export function balanceSeries(
	transactions: readonly Transaction[],
	currency: string,
	period: Period,
	toLocal: ToLocal = browserLocal,
): BalanceSeries {
	const points: BalancePoint[] = [];
	let opening: number | null = null;
	for (const transaction of transactions) {
		const balance = transaction.balances.find(
			(entry) => entry.currency === currency,
		);
		if (!balance) {
			continue;
		}
		const year = toLocal(transaction.at).year;
		if (period.kind === "year" && year < period.year) {
			opening = balance.amount;
			continue;
		}
		if (!inPeriod(period, year)) {
			continue;
		}
		const last = points.at(-1);
		if (last && last.at === transaction.at) {
			last.amount = balance.amount;
		} else {
			points.push({ at: transaction.at, amount: balance.amount });
		}
	}
	return { points, opening };
}

// ---------------------------------------------------------------------------
// League of Legends のストア
// ---------------------------------------------------------------------------

/** 購入した品目の支払い方。この順に図表の色を割り当てる。 */
export const PAID_WITH = ["rp", "be", "none"] as const;

export type PaidWith = (typeof PAID_WITH)[number];

export interface CategoryPurchases {
	/** 品目の区分。品目 ID から決められなかったものは null。 */
	category: string | null;
	counts: Record<PaidWith, number>;
	total: number;
}

function paidWith(transaction: Transaction): PaidWith {
	const spent = (currency: string) =>
		transaction.deltas.some(
			(delta) => delta.currency === currency && delta.amount < 0,
		);
	if (spent("RP")) {
		return "rp";
	}
	return spent("BE") ? "be" : "none";
}

/**
 * 購入した品目の数を、区分と支払い方で数える。多い順に並べる。
 * 贈り物として買ったものは含めない。
 */
export function purchasesByCategory(
	transactions: readonly Transaction[],
): CategoryPurchases[] {
	const groups = new Map<string | null, CategoryPurchases>();
	for (const transaction of transactions) {
		if (transaction.kind !== "purchase") {
			continue;
		}
		const category = transaction.item.category;
		let group = groups.get(category);
		if (!group) {
			group = { category, counts: { rp: 0, be: 0, none: 0 }, total: 0 };
			groups.set(category, group);
		}
		group.counts[paidWith(transaction)] += 1;
		group.total += 1;
	}
	return [...groups.values()].sort(
		(a, b) =>
			b.total - a.total || (a.category ?? "").localeCompare(b.category ?? ""),
	);
}

export interface StoreSummary {
	/** 取引の行数。 */
	transactions: number;
	/** 購入した品目の数。贈り物として買ったものは含めない。 */
	purchases: number;
	/** RP を購入した回数と、得た RP の合計。 */
	topUps: number;
	toppedUpRp: number;
	/** 品目の購入と贈り物に使った量。 */
	spentRp: number;
	spentBe: number;
}

export function storeSummary(
	transactions: readonly Transaction[],
): StoreSummary {
	const summary: StoreSummary = {
		transactions: transactions.length,
		purchases: 0,
		topUps: 0,
		toppedUpRp: 0,
		spentRp: 0,
		spentBe: 0,
	};
	for (const transaction of transactions) {
		if (transaction.kind === "purchase") {
			summary.purchases += 1;
		}
		if (transaction.kind === "topUp") {
			summary.topUps += 1;
		}
		for (const delta of transaction.deltas) {
			if (delta.currency === "RP") {
				if (transaction.kind === "topUp" && delta.amount > 0) {
					summary.toppedUpRp += delta.amount;
				} else if (delta.amount < 0) {
					summary.spentRp -= delta.amount;
				}
			} else if (delta.currency === "BE" && delta.amount < 0) {
				summary.spentBe -= delta.amount;
			}
		}
	}
	return summary;
}

export type GiftDirection = "sent" | "received";

export interface Gift {
	key: string;
	at: EpochMs;
	direction: GiftDirection;
	/** 贈ったもの。品目か、RP そのものか。 */
	what: "item" | "rp";
	item: TransactionItem;
	/** 中身が分からない贈り物（ミステリーギフト）として買ったもの。 */
	mystery: boolean;
	/** この贈り物で動いた自分の通貨。贈るための支払いは負、受け取った RP は正。 */
	deltas: CurrencyAmount[];
}

const GIFT_PURCHASES = new Set(["PURCHASED_GIFT", "PURCHASED_MYSTERY_GIFT"]);
/** 購入の行と送付の行を同じ贈り物とみなす、時刻の差の上限。 */
const GIFT_PAIR_WINDOW_MS = 10_000;

/**
 * 贈り物を 1 件ずつにまとめる。新しい順に並べる。
 *
 * 品目を贈ると、支払いの行（`PURCHASED_GIFT` など）と品目を移す行
 * （`ITEM_TRANSFER_SENT`）の 2 行が記録される。同じ品目で時刻が近い 2 行は
 * 1 件の贈り物として扱い、二重に数えない。相手の無い行は、そのまま 1 件にする。
 */
export function gifts(transactions: readonly Transaction[]): Gift[] {
	const purchases = transactions.filter(
		(transaction) =>
			transaction.rawKind !== null && GIFT_PURCHASES.has(transaction.rawKind),
	);
	const paired = new Set<Transaction>();
	const result: Gift[] = [];
	let serial = 0;
	const add = (
		transaction: Transaction,
		gift: Pick<Gift, "direction" | "what" | "mystery" | "deltas">,
	) => {
		serial += 1;
		result.push({
			...gift,
			key: `${transaction.id ?? "gift"}-${serial}`,
			at: transaction.at,
			item: transaction.item,
		});
	};

	for (const transaction of transactions) {
		switch (transaction.rawKind) {
			case "ITEM_TRANSFER_SENT": {
				const purchase = purchases.find(
					(candidate) =>
						!paired.has(candidate) &&
						candidate.item.rawId === transaction.item.rawId &&
						Math.abs(candidate.at - transaction.at) <= GIFT_PAIR_WINDOW_MS,
				);
				if (purchase) {
					paired.add(purchase);
				}
				add(transaction, {
					direction: "sent",
					what: "item",
					mystery: purchase?.rawKind === "PURCHASED_MYSTERY_GIFT",
					deltas: purchase?.deltas ?? [],
				});
				break;
			}
			case "RP_TRANSFER_SENT":
				add(transaction, {
					direction: "sent",
					what: "rp",
					mystery: false,
					deltas: transaction.deltas,
				});
				break;
			case "ITEM_TRANSFER_RECEIVED":
				add(transaction, {
					direction: "received",
					what: "item",
					mystery: false,
					deltas: [],
				});
				break;
			case "RP_TRANSFER_RECEIVED":
				add(transaction, {
					direction: "received",
					what: "rp",
					mystery: false,
					deltas: transaction.deltas,
				});
				break;
		}
	}

	// 品目を移す行と組にならなかった支払いの行は、それだけで 1 件の贈り物にする
	for (const purchase of purchases) {
		if (!paired.has(purchase)) {
			add(purchase, {
				direction: "sent",
				what: "item",
				mystery: purchase.rawKind === "PURCHASED_MYSTERY_GIFT",
				deltas: purchase.deltas,
			});
		}
	}

	return result.sort((a, b) => b.at - a.at);
}
