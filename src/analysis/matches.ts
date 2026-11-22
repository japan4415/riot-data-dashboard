import type { Dataset, EpochMs, Match, QueueCategory } from "../model/types.ts";
import { browserLocal, type ToLocal } from "./localTime.ts";
import { inPeriod, type Period } from "./period.ts";

/**
 * 試合の区分。この順に図表の色を割り当て、表もこの順に並べるので、並びを変えない。
 */
export const QUEUE_CATEGORIES = [
	"ranked",
	"normal",
	"other",
	"custom",
	"practice",
] as const satisfies readonly QueueCategory[];

export type CategoryCounts = Record<QueueCategory, number>;

export function emptyCategoryCounts(): CategoryCounts {
	return { ranked: 0, normal: 0, other: 0, custom: 0, practice: 0 };
}

/** 試合の時刻。開始が無ければ終了を使う。どちらも無ければ null。 */
export function matchTime(match: Match): EpochMs | null {
	return match.startedAt ?? match.endedAt;
}

/** 試合が期間に入るか。時刻が分からない試合は、全期間のときだけ数える。 */
export function matchInPeriod(
	match: Match,
	period: Period,
	toLocal: ToLocal,
): boolean {
	const at = matchTime(match);
	return at === null
		? period.kind === "all"
		: inPeriod(period, toLocal(at).year);
}

/**
 * 1 つのゲームの、期間内の試合を古い順に返す。
 * 時刻が分からない試合は末尾に置く。
 */
export function matchesOf<Game extends Match["game"]>(
	dataset: Dataset,
	game: Game,
	period: Period,
	toLocal: ToLocal = browserLocal,
): Array<Extract<Match, { game: Game }>> {
	const matches = dataset.matches.filter(
		(match): match is Extract<Match, { game: Game }> =>
			match.game === game && matchInPeriod(match, period, toLocal),
	);
	return matches.sort(
		(a, b) =>
			(matchTime(a) ?? Number.POSITIVE_INFINITY) -
			(matchTime(b) ?? Number.POSITIVE_INFINITY),
	);
}

export interface WinLoss {
	wins: number;
	losses: number;
	/** 勝ち ÷（勝ち + 負け）。勝敗の付いた試合が無ければ null。 */
	winRate: number | null;
}

/** 勝率に数える試合だけから、勝ち負けを数える。 */
export function winLoss(matches: readonly Match[]): WinLoss {
	let wins = 0;
	let losses = 0;
	for (const match of matches) {
		if (!match.countsForWinRate) {
			continue;
		}
		if (match.outcome === "win") {
			wins += 1;
		} else if (match.outcome === "loss") {
			losses += 1;
		}
	}
	const decided = wins + losses;
	return { wins, losses, winRate: decided > 0 ? wins / decided : null };
}

export interface MatchSummary extends WinLoss {
	/** 練習を除いた試合数。 */
	matches: number;
	/** 練習に区分した記録の数。 */
	practice: number;
	/** 試合履歴にある時間の合計（秒）。練習も含む。 */
	playSeconds: number;
	/** 練習を除いた試合の、長さの中央値（秒）。長さが分かる試合が無ければ null。 */
	medianSeconds: number | null;
}

export function matchSummary(matches: readonly Match[]): MatchSummary {
	let count = 0;
	let practice = 0;
	let playSeconds = 0;
	const lengths: number[] = [];
	for (const match of matches) {
		playSeconds += match.durationSec ?? 0;
		if (match.queue.category === "practice") {
			practice += 1;
			continue;
		}
		count += 1;
		if (match.durationSec !== null) {
			lengths.push(match.durationSec);
		}
	}
	lengths.sort((a, b) => a - b);
	return {
		...winLoss(matches),
		matches: count,
		practice,
		playSeconds,
		medianSeconds: lengths[Math.floor(lengths.length / 2)] ?? null,
	};
}

/** 試合の種別ごとの記録。 */
export interface QueueRecord extends WinLoss {
	key: string;
	category: QueueCategory;
	/** 元データでの種別の名前。小分類が無ければ大分類。どちらも無ければ null。 */
	name: string | null;
	/** その種別の記録の数。 */
	matches: number;
	/** 勝率に数える試合があるか。無い種別は、勝敗を表示しない。 */
	counted: boolean;
	playSeconds: number;
}

/**
 * 試合を種別ごとにまとめる。区分の順に並べ、同じ区分の中では多い順に並べる。
 */
export function queueRecords(matches: readonly Match[]): QueueRecord[] {
	const groups = new Map<string, Match[]>();
	for (const match of matches) {
		const name = match.queue.rawType ?? match.queue.rawMode;
		const key = `${match.queue.category}:${name ?? ""}`;
		const group = groups.get(key);
		if (group) {
			group.push(match);
		} else {
			groups.set(key, [match]);
		}
	}

	const records: QueueRecord[] = [];
	for (const [key, group] of groups) {
		const first = group[0];
		if (!first) {
			continue;
		}
		records.push({
			...winLoss(group),
			key,
			category: first.queue.category,
			name: first.queue.rawType ?? first.queue.rawMode,
			matches: group.length,
			counted: group.some((match) => match.countsForWinRate),
			playSeconds: group.reduce(
				(sum, match) => sum + (match.durationSec ?? 0),
				0,
			),
		});
	}
	return records.sort(
		(a, b) =>
			QUEUE_CATEGORIES.indexOf(a.category) -
				QUEUE_CATEGORIES.indexOf(b.category) ||
			b.matches - a.matches ||
			a.key.localeCompare(b.key),
	);
}

export interface MatchBucket {
	/** 全期間では年、1 年分では月（1〜12）。 */
	key: number;
	counts: CategoryCounts;
}

export interface MatchBuckets {
	buckets: MatchBucket[];
	/** 時刻が分からず、どの区切りにも入れられなかった試合の数。 */
	undated: number;
}

/**
 * 区分ごとの試合数を、時間の区切りごとにまとめる。
 *
 * 全期間なら、最初の試合の年から最後の試合の年までを年ごとに区切る。
 * 1 年分なら月ごとに区切る。試合が無い区切りも含める。
 */
export function matchBuckets(
	matches: readonly Match[],
	period: Period,
	toLocal: ToLocal = browserLocal,
): MatchBuckets {
	const dated: Array<{ year: number; month: number; category: QueueCategory }> =
		[];
	let undated = 0;
	for (const match of matches) {
		const at = matchTime(match);
		if (at === null) {
			undated += 1;
			continue;
		}
		const local = toLocal(at);
		dated.push({
			year: local.year,
			month: local.month,
			category: match.queue.category,
		});
	}

	const keys: number[] = [];
	if (period.kind === "year") {
		for (let month = 1; month <= 12; month += 1) {
			keys.push(month);
		}
	} else if (dated.length > 0) {
		const years = dated.map((item) => item.year);
		const last = Math.max(...years);
		for (let year = Math.min(...years); year <= last; year += 1) {
			keys.push(year);
		}
	}

	const buckets = new Map<number, MatchBucket>(
		keys.map((key) => [key, { key, counts: emptyCategoryCounts() }]),
	);
	for (const item of dated) {
		const bucket = buckets.get(period.kind === "all" ? item.year : item.month);
		if (bucket) {
			bucket.counts[item.category] += 1;
		}
	}
	return { buckets: [...buckets.values()], undated };
}
