import type { LorMatch } from "../model/types.ts";
import { type WinLoss, winLoss } from "./matches.ts";

/** 練習（チュートリアル、対 AI 戦）を除いた試合。LoR の集計はこれを対象にする。 */
function ratedMatches(matches: readonly LorMatch[]): LorMatch[] {
	return matches.filter((match) => match.queue.category !== "practice");
}

export interface FactionCombo extends WinLoss {
	key: string;
	/** デッキの地域。名前の順に並べる。記録が無ければ空。 */
	factions: string[];
	matches: number;
}

/**
 * デッキの地域の組み合わせごとの試合数と勝敗。試合が多い順に並べる。
 * 地域の並びが違うだけの組み合わせは、同じものとして数える。
 */
export function factionCombos(matches: readonly LorMatch[]): FactionCombo[] {
	const groups = new Map<string, { factions: string[]; matches: LorMatch[] }>();
	for (const match of ratedMatches(matches)) {
		const factions = [...match.factions].sort((a, b) => a.localeCompare(b));
		const key = factions.join("+");
		const group = groups.get(key);
		if (group) {
			group.matches.push(match);
		} else {
			groups.set(key, { factions, matches: [match] });
		}
	}
	return [...groups]
		.map(([key, group]) => ({
			...winLoss(group.matches),
			key,
			factions: group.factions,
			matches: group.matches.length,
		}))
		.sort((a, b) => b.matches - a.matches || a.key.localeCompare(b.key));
}

export interface TurnBin {
	/** この区切りに入るターン数の下限。 */
	from: number;
	/** 上限。最後の区切りが「これ以上すべて」を表すときは null。 */
	to: number | null;
	wins: number;
	losses: number;
	/** 勝敗が付いていない試合。 */
	others: number;
}

/** ターン数の区切りが増えすぎないよう、これを超える分は最後の区切りにまとめる。 */
const MAX_TURN_BINS = 16;

/**
 * ターン数の分布。`binSize` ターンごとに区切り、試合が無い区切りも含める。
 * ターン数の記録が無い試合は数えない。
 */
export function turnHistogram(
	matches: readonly LorMatch[],
	binSize = 5,
): TurnBin[] {
	const rated = ratedMatches(matches).filter(
		(match) => match.turnCount !== null && match.turnCount >= 0,
	);
	if (rated.length === 0) {
		return [];
	}
	const maxTurn = Math.max(...rated.map((match) => match.turnCount ?? 0));
	const count = Math.min(MAX_TURN_BINS, Math.floor(maxTurn / binSize) + 1);
	const bins: TurnBin[] = Array.from({ length: count }, (_, index) => ({
		from: index * binSize,
		to:
			index === count - 1 && maxTurn >= count * binSize
				? null
				: (index + 1) * binSize - 1,
		wins: 0,
		losses: 0,
		others: 0,
	}));
	for (const match of rated) {
		const bin =
			bins[Math.min(count - 1, Math.floor((match.turnCount ?? 0) / binSize))];
		if (!bin) {
			continue;
		}
		if (match.outcome === "win") {
			bin.wins += 1;
		} else if (match.outcome === "loss") {
			bin.losses += 1;
		} else {
			bin.others += 1;
		}
	}
	return bins;
}

/** ターン数の中央値。記録が無ければ null。 */
export function medianTurns(matches: readonly LorMatch[]): number | null {
	const turns = ratedMatches(matches)
		.flatMap((match) => (match.turnCount === null ? [] : [match.turnCount]))
		.sort((a, b) => a - b);
	return turns[Math.floor(turns.length / 2)] ?? null;
}

export interface ReasonRecord extends WinLoss {
	/** 決着の理由。元の値のまま。記録が無ければ null。 */
	reason: string | null;
	matches: number;
}

/** 決着の理由ごとの試合数と勝敗。試合が多い順に並べる。 */
export function outcomeReasons(matches: readonly LorMatch[]): ReasonRecord[] {
	const groups = new Map<string | null, LorMatch[]>();
	for (const match of ratedMatches(matches)) {
		const group = groups.get(match.outcomeReason);
		if (group) {
			group.push(match);
		} else {
			groups.set(match.outcomeReason, [match]);
		}
	}
	return [...groups]
		.map(([reason, group]) => ({
			...winLoss(group),
			reason,
			matches: group.length,
		}))
		.sort(
			(a, b) =>
				b.matches - a.matches || (a.reason ?? "").localeCompare(b.reason ?? ""),
		);
}
