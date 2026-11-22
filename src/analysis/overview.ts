import type { Dataset, EpochMs } from "../model/types.ts";
import {
	ACTIVITY_GROUPS,
	type ActivityGroup,
	type ActivityIndex,
	activeDaysByGroup,
	daysInPeriod,
} from "./activity.ts";
import { browserLocal, type DayKey, type ToLocal } from "./localTime.ts";
import { matchInPeriod } from "./matches.ts";
import { inPeriod, type Period } from "./period.ts";

export interface Span {
	first: EpochMs;
	last: EpochMs;
}

/** すべての種類のデータを通して、もっとも古い記録と新しい記録の時刻を求める。 */
export function recordSpan(dataset: Dataset): Span | null {
	let first: EpochMs | null = null;
	let last: EpochMs | null = null;
	const see = (at: EpochMs | null) => {
		if (at === null) {
			return;
		}
		if (first === null || at < first) {
			first = at;
		}
		if (last === null || at > last) {
			last = at;
		}
	};

	for (const item of dataset.logins) see(item.at);
	for (const item of dataset.matches) {
		see(item.startedAt);
		see(item.endedAt);
	}
	for (const item of dataset.payments) see(item.at);
	for (const item of dataset.transactions) see(item.at);
	for (const item of dataset.accountEvents) see(item.at);
	for (const item of dataset.penalties) see(item.at);
	for (const item of dataset.chatLogs) see(item.matchDate);
	for (const item of dataset.tickets) see(item.createdAt);

	return first === null || last === null ? null : { first, last };
}

/** 記録がある年を、古い順に返す。途中の記録が無い年も含む。 */
export function recordYears(
	dataset: Dataset,
	toLocal: ToLocal = browserLocal,
): number[] {
	const span = recordSpan(dataset);
	if (!span) {
		return [];
	}
	const years: number[] = [];
	const lastYear = toLocal(span.last).year;
	for (let year = toLocal(span.first).year; year <= lastYear; year += 1) {
		years.push(year);
	}
	return years;
}

export interface MoneyTotal {
	/** 通貨コード。例: `JPY` */
	currency: string;
	/** 金額を 100 倍した整数。 */
	amountX100: number;
}

export interface OverviewStats {
	/** いずれかのゲームで活動した日数。 */
	activeDays: number;
	/** 練習を除いた試合数。 */
	matches: number;
	/** 試合履歴にある時間の合計（秒）。練習も含む。 */
	playSeconds: number;
	/** 試合履歴が 1 件でもあるか。無いときは、試合数とプレイ時間を表示しない。 */
	hasMatches: boolean;
	/** 現金での支払いの合計。通貨ごとに分け、換算はしない。 */
	spending: MoneyTotal[];
}

export function overviewStats(
	dataset: Dataset,
	index: ActivityIndex,
	period: Period,
	toLocal: ToLocal = browserLocal,
): OverviewStats {
	let matches = 0;
	let playSeconds = 0;
	for (const match of dataset.matches) {
		if (!matchInPeriod(match, period, toLocal)) {
			continue;
		}
		if (match.queue.category !== "practice") {
			matches += 1;
		}
		playSeconds += match.durationSec ?? 0;
	}

	const totals = new Map<string, number>();
	for (const payment of dataset.payments) {
		if (inPeriod(period, toLocal(payment.at).year)) {
			totals.set(
				payment.currency,
				(totals.get(payment.currency) ?? 0) + payment.amountX100,
			);
		}
	}
	const spending = [...totals]
		.map(([currency, amountX100]) => ({ currency, amountX100 }))
		.sort((a, b) => a.currency.localeCompare(b.currency));

	return {
		activeDays: daysInPeriod(index, period).length,
		matches,
		playSeconds,
		hasMatches: dataset.matches.length > 0,
		spending,
	};
}

export interface MatchRecord {
	/** 練習を除いた試合数。 */
	matches: number;
	wins: number;
	losses: number;
	/** 勝ち ÷（勝ち + 負け）。勝敗の付いた試合が無ければ null。 */
	winRate: number | null;
	/** 試合履歴にある時間の合計（秒）。練習も含む。 */
	playSeconds: number;
}

export interface GroupSummary {
	group: ActivityGroup;
	activeDays: number;
	firstDay: DayKey | null;
	lastDay: DayKey | null;
	/** 試合履歴が無い区分では null。 */
	record: MatchRecord | null;
}

/** 活動の区分ごとの要約。期間内に活動が無い区分は含めない。 */
export function groupSummaries(
	dataset: Dataset,
	index: ActivityIndex,
	period: Period,
	toLocal: ToLocal = browserLocal,
): GroupSummary[] {
	const days = daysInPeriod(index, period);
	const activeDays = activeDaysByGroup(days);

	const records = new Map<ActivityGroup, MatchRecord>();
	const gamesWithMatches = new Set<ActivityGroup>(
		dataset.matches.map((match) => match.game),
	);
	for (const match of dataset.matches) {
		if (!matchInPeriod(match, period, toLocal)) {
			continue;
		}
		let record = records.get(match.game);
		if (!record) {
			record = {
				matches: 0,
				wins: 0,
				losses: 0,
				winRate: null,
				playSeconds: 0,
			};
			records.set(match.game, record);
		}
		if (match.queue.category !== "practice") {
			record.matches += 1;
		}
		if (match.countsForWinRate) {
			if (match.outcome === "win") {
				record.wins += 1;
			} else if (match.outcome === "loss") {
				record.losses += 1;
			}
		}
		record.playSeconds += match.durationSec ?? 0;
	}
	for (const record of records.values()) {
		const decided = record.wins + record.losses;
		record.winRate = decided > 0 ? record.wins / decided : null;
	}

	const summaries: GroupSummary[] = [];
	for (const group of ACTIVITY_GROUPS) {
		const record = records.get(group) ?? null;
		if (activeDays[group] === 0 && record === null) {
			continue;
		}
		let firstDay: DayKey | null = null;
		let lastDay: DayKey | null = null;
		for (const day of days) {
			if (day.groups.includes(group)) {
				firstDay ??= day.day;
				lastDay = day.day;
			}
		}
		summaries.push({
			group,
			activeDays: activeDays[group],
			firstDay,
			lastDay,
			record:
				record ??
				(gamesWithMatches.has(group)
					? { matches: 0, wins: 0, losses: 0, winRate: null, playSeconds: 0 }
					: null),
		});
	}
	return summaries;
}
