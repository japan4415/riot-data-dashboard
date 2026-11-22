import type {
	EpochMs,
	InventoryCategory,
	InventoryItem,
	Outcome,
	WildRiftMatch,
} from "../model/types.ts";
import { matchTime } from "./matches.ts";

/** ランクのティア。下位から上位の順。 */
export const RANK_TIERS = [
	"Iron",
	"Bronze",
	"Silver",
	"Gold",
	"Platinum",
	"Emerald",
	"Diamond",
	"Master",
	"Grandmaster",
	"Challenger",
	"Sovereign",
] as const;

/** 1 つのティアに含まれる段階の数（IV〜I）。 */
export const DIVISIONS_PER_TIER = 4;

const DIVISIONS: Readonly<Record<string, number>> = {
	I: 1,
	II: 2,
	III: 3,
	IV: 4,
};

export interface ParsedRank {
	tier: string;
	tierIndex: number;
	/** 1（上）〜4（下）。段階の無いティアでは null。 */
	division: number | null;
	/** ランクの高さ。大きいほど上位で、段階が 1 つ上がると 1 増える。 */
	ordinal: number;
}

/**
 * `Gold III` のようなランクの表記を読む。
 * 知らないティアや、読めない表記は null にする。
 */
export function parseRank(rank: string | null): ParsedRank | null {
	if (rank === null) {
		return null;
	}
	const [tierText, divisionText, ...rest] = rank.trim().split(/\s+/);
	if (tierText === undefined || rest.length > 0) {
		return null;
	}
	const tierIndex = RANK_TIERS.findIndex(
		(tier) => tier.toLowerCase() === tierText.toLowerCase(),
	);
	const tier = RANK_TIERS[tierIndex];
	if (tier === undefined) {
		return null;
	}
	let division: number | null = null;
	if (divisionText !== undefined) {
		division = DIVISIONS[divisionText.toUpperCase()] ?? null;
		if (division === null) {
			return null;
		}
	}
	return {
		tier,
		tierIndex,
		division,
		ordinal:
			tierIndex * DIVISIONS_PER_TIER +
			(division === null ? 0 : DIVISIONS_PER_TIER - division),
	};
}

export interface RankPoint {
	/** 古い順に数えた、ランクの記録がある試合の通し番号（0 始まり）。 */
	index: number;
	at: EpochMs;
	rank: string;
	ordinal: number;
	outcome: Outcome;
}

export interface RankHistory {
	points: RankPoint[];
	/** ランクの記録はあるが、読めなかった試合の数。 */
	unreadable: number;
}

/**
 * 試合ごとのランクを、古い順に並べる。
 * ランクまたは時刻の記録が無い試合は含めない。
 */
export function rankHistory(matches: readonly WildRiftMatch[]): RankHistory {
	const rows: Array<Omit<RankPoint, "index">> = [];
	let unreadable = 0;
	for (const match of matches) {
		const at = matchTime(match);
		if (match.rank === null || at === null) {
			continue;
		}
		const parsed = parseRank(match.rank);
		if (!parsed) {
			unreadable += 1;
			continue;
		}
		rows.push({
			at,
			rank: match.rank,
			ordinal: parsed.ordinal,
			outcome: match.outcome,
		});
	}
	rows.sort((a, b) => a.at - b.at);
	return {
		points: rows.map((row, index) => ({ ...row, index })),
		unreadable,
	};
}

/** もっとも高いランクの記録。同じ高さなら、最初に届いた試合を返す。 */
export function highestRank(points: readonly RankPoint[]): RankPoint | null {
	let best: RankPoint | null = null;
	for (const point of points) {
		if (best === null || point.ordinal > best.ordinal) {
			best = point;
		}
	}
	return best;
}

/** 所持品の分類。画面に並べる順。 */
export const INVENTORY_CATEGORIES = [
	"champion",
	"skin",
	"emote",
	"icon",
	"iconBorder",
	"banner",
	"bauble",
	"consumable",
] as const satisfies readonly InventoryCategory[];

export interface InventoryCount {
	category: InventoryCategory;
	count: number;
}

/** 分類ごとの所持品の数。1 つも無い分類は含めない。 */
export function inventoryCounts(
	inventory: readonly InventoryItem[],
): InventoryCount[] {
	return INVENTORY_CATEGORIES.map((category) => ({
		category,
		count: inventory.filter((item) => item.category === category).length,
	})).filter((entry) => entry.count > 0);
}
