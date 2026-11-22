import {
	type CurrencyAmount,
	type Dataset,
	emptyDataset,
	type GameId,
	type LoginEvent,
	type LoginKind,
	type LoginTarget,
	type LorMatch,
	type Match,
	type Outcome,
	type Payment,
	type QueueCategory,
	type Transaction,
	type TransactionKind,
	type WildRiftMatch,
} from "../model/types.ts";

/** テスト用。ISO 8601 の文字列をエポックミリ秒にする。 */
export function at(iso: string): number {
	const value = Date.parse(iso);
	if (Number.isNaN(value)) {
		throw new Error(`日時として読めません: ${iso}`);
	}
	return value;
}

export function login(
	iso: string,
	target: LoginTarget,
	kind: LoginKind = "login",
): LoginEvent {
	return {
		at: at(iso),
		target,
		rawProduct: null,
		kind,
		rawType: kind,
		ip: null,
	};
}

interface MatchOptions {
	game?: Match["game"];
	minutes?: number;
	category?: QueueCategory;
	outcome?: Outcome;
	countsForWinRate?: boolean;
	/** 元データでの小分類の名前。 */
	rawType?: string | null;
	/** 元データでの大分類の名前。 */
	rawMode?: string | null;
}

let matchSerial = 0;

export function match(iso: string | null, options: MatchOptions = {}): Match {
	const {
		game = "valorant",
		minutes = 30,
		category = "ranked",
		outcome = "win",
		countsForWinRate = outcome !== "none" && category !== "practice",
		rawType = null,
		rawMode = null,
	} = options;
	const startedAt = iso === null ? null : at(iso);
	matchSerial += 1;
	const base = {
		id: `match-${matchSerial}`,
		startedAt,
		endedAt: startedAt === null ? null : startedAt + minutes * 60_000,
		durationSec: minutes * 60,
		queue: { category, rawMode, rawType },
		outcome,
		countsForWinRate,
	};
	switch (game) {
		case "valorant":
			return { ...base, game, realm: null };
		case "lor":
			return {
				...base,
				game,
				deckId: null,
				factions: [],
				turnCount: null,
				outcomeReason: null,
				platform: null,
				orderOfPlay: null,
				realm: null,
			};
		case "wildrift":
			return { ...base, game, rank: null, accountLevel: null };
	}
}

/** LoR の試合。地域、ターン数、決着の理由を指定できる。 */
export function lorMatch(
	iso: string | null,
	fields: Partial<
		Pick<LorMatch, "factions" | "turnCount" | "outcomeReason">
	> = {},
	options: Omit<MatchOptions, "game"> = {},
): LorMatch {
	return {
		...(match(iso, { ...options, game: "lor" }) as LorMatch),
		...fields,
	};
}

/** Wild Rift の試合。その時点のランクを指定できる。 */
export function wildriftMatch(
	iso: string | null,
	rank: string | null,
	options: Omit<MatchOptions, "game"> = {},
): WildRiftMatch {
	return {
		...(match(iso, { ...options, game: "wildrift" }) as WildRiftMatch),
		rank,
	};
}

interface TransactionOptions {
	game?: GameId;
	kind?: TransactionKind;
	rawKind?: string | null;
	rawId?: string | null;
	name?: string | null;
	category?: string | null;
	deltas?: CurrencyAmount[];
	balances?: CurrencyAmount[];
}

let transactionSerial = 0;

export function transaction(
	iso: string,
	options: TransactionOptions = {},
): Transaction {
	transactionSerial += 1;
	return {
		game: options.game ?? "lol",
		id: `transaction-${transactionSerial}`,
		at: at(iso),
		kind: options.kind ?? "purchase",
		rawKind: options.rawKind ?? null,
		source: null,
		item: {
			name: options.name ?? null,
			rawId: options.rawId ?? null,
			category: options.category ?? null,
			quantity: null,
		},
		deltas: options.deltas ?? [],
		balances: options.balances ?? [],
		refunded: null,
		ip: null,
	};
}

export function payment(
	iso: string,
	currency: string,
	amountX100: number,
	game: Payment["game"] = "valorant",
): Payment {
	return {
		game,
		id: null,
		at: at(iso),
		currency,
		amountX100,
		method: null,
		granted: null,
		ip: null,
	};
}

export function datasetOf(parts: Partial<Dataset>): Dataset {
	return { ...emptyDataset(), ...parts };
}
