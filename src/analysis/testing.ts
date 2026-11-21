import {
	type Dataset,
	emptyDataset,
	type LoginEvent,
	type LoginKind,
	type LoginTarget,
	type Match,
	type Outcome,
	type Payment,
	type QueueCategory,
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
}

let matchSerial = 0;

export function match(iso: string | null, options: MatchOptions = {}): Match {
	const {
		game = "valorant",
		minutes = 30,
		category = "ranked",
		outcome = "win",
		countsForWinRate = outcome !== "none" && category !== "practice",
	} = options;
	const startedAt = iso === null ? null : at(iso);
	matchSerial += 1;
	const base = {
		id: `match-${matchSerial}`,
		startedAt,
		endedAt: startedAt === null ? null : startedAt + minutes * 60_000,
		durationSec: minutes * 60,
		queue: { category, rawMode: null, rawType: null },
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
