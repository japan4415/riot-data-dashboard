import type {
	AccountEvent,
	ChatLog,
	Dataset,
	EpochMs,
	Penalty,
	SupportTicket,
} from "../model/types.ts";
import { browserLocal, type ToLocal } from "./localTime.ts";
import { inPeriod, type Period } from "./period.ts";

/** 時刻が期間に入るか。時刻が分からない記録は、全期間のときだけ含める。 */
function within(at: EpochMs | null, period: Period, toLocal: ToLocal): boolean {
	return at === null
		? period.kind === "all"
		: inPeriod(period, toLocal(at).year);
}

/** 時刻の新しい順に並べる。時刻が分からないものは末尾に置く。 */
function newestFirst<T>(items: T[], time: (item: T) => EpochMs | null): T[] {
	return items.sort(
		(a, b) =>
			(time(b) ?? Number.NEGATIVE_INFINITY) -
			(time(a) ?? Number.NEGATIVE_INFINITY),
	);
}

/** 期間内のアカウントの出来事。新しい順。 */
export function accountEvents(
	dataset: Dataset,
	period: Period,
	toLocal: ToLocal = browserLocal,
): AccountEvent[] {
	return newestFirst(
		dataset.accountEvents.filter((event) => within(event.at, period, toLocal)),
		(event) => event.at,
	);
}

/** 期間内のペナルティ。新しい順。 */
export function penalties(
	dataset: Dataset,
	period: Period,
	toLocal: ToLocal = browserLocal,
): Penalty[] {
	return newestFirst(
		dataset.penalties.filter((penalty) => within(penalty.at, period, toLocal)),
		(penalty) => penalty.at,
	);
}

/** 期間内に作られた問い合わせ。新しい順。やりとりは古い順に並べる。 */
export function tickets(
	dataset: Dataset,
	period: Period,
	toLocal: ToLocal = browserLocal,
): SupportTicket[] {
	return newestFirst(
		dataset.tickets
			.filter((ticket) => within(ticket.createdAt, period, toLocal))
			.map((ticket) => ({
				...ticket,
				comments: [...ticket.comments].sort(
					(a, b) =>
						(a.at ?? Number.POSITIVE_INFINITY) -
						(b.at ?? Number.POSITIVE_INFINITY),
				),
			})),
		(ticket) => ticket.createdAt,
	);
}

export interface ChatSummary {
	/** 期間内の、ログがある試合の数。 */
	matches: number;
	/** そのうち、発言が 1 つも無い試合の数。 */
	silentMatches: number;
	/** 発言の数。 */
	messages: number;
	/** 発言があった試合。新しい順。発言は古い順に並べる。 */
	logs: ChatLog[];
}

/** 期間内のチャットログの要約。発言が無い試合は、数だけを返す。 */
export function chatSummary(
	dataset: Dataset,
	period: Period,
	toLocal: ToLocal = browserLocal,
): ChatSummary {
	const inRange = dataset.chatLogs.filter((log) =>
		within(log.matchDate, period, toLocal),
	);
	const logs = newestFirst(
		inRange
			.filter((log) => log.messages.length > 0)
			.map((log) => ({
				...log,
				messages: [...log.messages].sort(
					(a, b) =>
						(a.at ?? Number.POSITIVE_INFINITY) -
						(b.at ?? Number.POSITIVE_INFINITY),
				),
			})),
		(log) => log.matchDate,
	);
	return {
		matches: inRange.length,
		silentMatches: inRange.length - logs.length,
		messages: logs.reduce((sum, log) => sum + log.messages.length, 0),
		logs,
	};
}

/** IP アドレスが記録されていた場面。 */
export const IP_SOURCES = ["login", "payment", "store"] as const;

export type IpSource = (typeof IP_SOURCES)[number];

export interface IpUsage {
	ip: string;
	/** 期間内に、このアドレスが記録されていた回数。 */
	count: number;
	first: EpochMs;
	last: EpochMs;
	/** 場面ごとの回数。 */
	sources: Record<IpSource, number>;
}

/**
 * 期間内に記録されていた IP アドレスを、アドレスごとにまとめる。回数が多い順に並べる。
 *
 * ログイン記録、現金での支払い、LoL のストアの取引を対象にする。
 */
export function ipUsage(
	dataset: Dataset,
	period: Period,
	toLocal: ToLocal = browserLocal,
): IpUsage[] {
	const usages = new Map<string, IpUsage>();
	const add = (ip: string | null, at: EpochMs, source: IpSource) => {
		if (ip === null || !inPeriod(period, toLocal(at).year)) {
			return;
		}
		let usage = usages.get(ip);
		if (!usage) {
			usage = {
				ip,
				count: 0,
				first: at,
				last: at,
				sources: { login: 0, payment: 0, store: 0 },
			};
			usages.set(ip, usage);
		}
		usage.count += 1;
		usage.sources[source] += 1;
		usage.first = Math.min(usage.first, at);
		usage.last = Math.max(usage.last, at);
	};

	for (const login of dataset.logins) add(login.ip, login.at, "login");
	for (const payment of dataset.payments) {
		add(payment.ip, payment.at, "payment");
	}
	for (const transaction of dataset.transactions) {
		add(transaction.ip, transaction.at, "store");
	}

	return [...usages.values()].sort(
		(a, b) => b.count - a.count || b.last - a.last || a.ip.localeCompare(b.ip),
	);
}
