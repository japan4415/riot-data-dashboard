import type { Dataset, EpochMs, LoginTarget } from "../model/types.ts";
import {
	browserLocal,
	type DayKey,
	dayKeyOf,
	dayKeyParts,
	dayNumber,
	type ToLocal,
} from "./localTime.ts";
import { inPeriod, type Period } from "./period.ts";

/**
 * 活動の区分。この順に図表の色を割り当てるので、並びを変えない。
 *
 * PC 版の LoL と TFT は、ログイン記録で区別できないため 1 つにまとめる。
 * Riot アカウント共通の記録（クライアントや認証）は、どのゲームの活動にも数えない。
 */
export const ACTIVITY_GROUPS = [
	"lol-tft-pc",
	"valorant",
	"tft-mobile",
	"wildrift",
	"lor",
] as const;

export type ActivityGroup = (typeof ACTIVITY_GROUPS)[number];

export type GroupCounts = Record<ActivityGroup, number>;

const LOGIN_GROUPS: Readonly<Partial<Record<LoginTarget, ActivityGroup>>> = {
	"lol-tft-pc": "lol-tft-pc",
	"tft-mobile": "tft-mobile",
	valorant: "valorant",
	wildrift: "wildrift",
	lor: "lor",
};

export function emptyGroupCounts(): GroupCounts {
	return {
		"lol-tft-pc": 0,
		valorant: 0,
		"tft-mobile": 0,
		wildrift: 0,
		lor: 0,
	};
}

/** 1 日分の活動。 */
export interface DayActivity {
	day: DayKey;
	/** ログインと試合の回数の合計。ログアウトなどの記録は数えない。 */
	count: number;
	/** 区分ごとの、ログインと試合の回数。 */
	counts: GroupCounts;
	/** その日に何らかの記録があった区分。回数が 0 でも、記録があれば含む。 */
	groups: ActivityGroup[];
}

/** 曜日（0 = 日曜）× 時刻（0〜23）ごとの回数。 */
export type HourWeekMatrix = number[][];

export interface ActivityIndex {
	/** 記録があった日だけを持つ。 */
	days: ReadonlyMap<DayKey, DayActivity>;
	/** 年ごとの、曜日 × 時刻の回数。期間で絞り込めるように年で分けて持つ。 */
	hourly: ReadonlyMap<number, HourWeekMatrix>;
	/** 活動があった最初の年から最後の年まで。途中の活動が無い年も含む。 */
	years: number[];
	first: EpochMs | null;
	last: EpochMs | null;
}

function emptyMatrix(): HourWeekMatrix {
	return Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
}

/**
 * ログイン記録と試合から、日ごとの活動をまとめる。
 *
 * 「回数」に数えるのは、ログインにあたる記録と試合である。ログアウトや認証の更新は、
 * その日に記録があったことだけを残し、回数には数えない。
 */
export function buildActivityIndex(
	dataset: Dataset,
	toLocal: ToLocal = browserLocal,
): ActivityIndex {
	const days = new Map<DayKey, DayActivity>();
	const hourly = new Map<number, HourWeekMatrix>();
	let first: EpochMs | null = null;
	let last: EpochMs | null = null;

	const add = (at: EpochMs, group: ActivityGroup, counted: boolean) => {
		const local = toLocal(at);
		const key = dayKeyOf(local);
		let day = days.get(key);
		if (!day) {
			day = { day: key, count: 0, counts: emptyGroupCounts(), groups: [] };
			days.set(key, day);
		}
		if (!day.groups.includes(group)) {
			day.groups.push(group);
		}
		if (counted) {
			day.count += 1;
			day.counts[group] += 1;
			let matrix = hourly.get(local.year);
			if (!matrix) {
				matrix = emptyMatrix();
				hourly.set(local.year, matrix);
			}
			const row = matrix[local.weekday];
			if (row) {
				row[local.hour] = (row[local.hour] ?? 0) + 1;
			}
		}
		if (first === null || at < first) {
			first = at;
		}
		if (last === null || at > last) {
			last = at;
		}
	};

	for (const login of dataset.logins) {
		const group = LOGIN_GROUPS[login.target];
		if (group) {
			add(login.at, group, login.kind === "login");
		}
	}
	for (const match of dataset.matches) {
		const at = match.startedAt ?? match.endedAt;
		if (at !== null) {
			add(at, match.game, true);
		}
	}

	const years: number[] = [];
	if (first !== null && last !== null) {
		const lastYear = toLocal(last).year;
		for (let year = toLocal(first).year; year <= lastYear; year += 1) {
			years.push(year);
		}
	}

	for (const day of days.values()) {
		day.groups.sort(
			(a, b) => ACTIVITY_GROUPS.indexOf(a) - ACTIVITY_GROUPS.indexOf(b),
		);
	}

	return { days, hourly, years, first, last };
}

/** 期間に含まれる活動日を、日付の順に返す。 */
export function daysInPeriod(
	index: ActivityIndex,
	period: Period,
): DayActivity[] {
	const result: DayActivity[] = [];
	for (const day of index.days.values()) {
		if (inPeriod(period, dayKeyParts(day.day).year)) {
			result.push(day);
		}
	}
	return result.sort((a, b) => a.day - b.day);
}

/** 区分ごとの活動日数。 */
export function activeDaysByGroup(days: readonly DayActivity[]): GroupCounts {
	const result = emptyGroupCounts();
	for (const day of days) {
		for (const group of day.groups) {
			result[group] += 1;
		}
	}
	return result;
}

export interface Streak {
	length: number;
	start: DayKey;
	end: DayKey;
}

/** 連続して活動した日数の最長。`days` は日付の順に並んでいること。 */
export function longestStreak(days: readonly DayActivity[]): Streak | null {
	let best: Streak | null = null;
	let start: DayKey | null = null;
	let previous: number | null = null;
	let length = 0;

	for (const day of days) {
		const number = dayNumber(day.day);
		if (previous !== null && number === previous + 1 && start !== null) {
			length += 1;
		} else {
			start = day.day;
			length = 1;
		}
		previous = number;
		if (start !== null && (best === null || length > best.length)) {
			best = { length, start, end: day.day };
		}
	}
	return best;
}

export interface ActivityBucket {
	/** 全期間では年、1 年分では月（1〜12）。 */
	key: number;
	/** 区分ごとの活動日数。 */
	activeDays: GroupCounts;
}

/**
 * 区分ごとの活動日数を、時間の区切りごとにまとめる。
 * 全期間なら年ごと、1 年分なら月ごとに区切る。活動が無い区切りも含める。
 */
export function activityBuckets(
	index: ActivityIndex,
	period: Period,
): ActivityBucket[] {
	const keys =
		period.kind === "all"
			? index.years
			: Array.from({ length: 12 }, (_, month) => month + 1);
	const buckets = new Map<number, ActivityBucket>(
		keys.map((key) => [key, { key, activeDays: emptyGroupCounts() }]),
	);

	for (const day of index.days.values()) {
		const { year, month } = dayKeyParts(day.day);
		if (!inPeriod(period, year)) {
			continue;
		}
		const bucket = buckets.get(period.kind === "all" ? year : month);
		if (!bucket) {
			continue;
		}
		for (const group of day.groups) {
			bucket.activeDays[group] += 1;
		}
	}
	return [...buckets.values()];
}

/** 期間内の、曜日 × 時刻ごとの回数。 */
export function hourWeekMatrix(
	index: ActivityIndex,
	period: Period,
): HourWeekMatrix {
	const total = emptyMatrix();
	for (const [year, matrix] of index.hourly) {
		if (!inPeriod(period, year)) {
			continue;
		}
		matrix.forEach((row, weekday) => {
			row.forEach((count, hour) => {
				const target = total[weekday];
				if (target) {
					target[hour] = (target[hour] ?? 0) + count;
				}
			});
		});
	}
	return total;
}

export interface BusiestSlot {
	weekday: number;
	hour: number;
	count: number;
}

/** もっとも回数が多い曜日と時刻。記録が無ければ null。 */
export function busiestSlot(matrix: HourWeekMatrix): BusiestSlot | null {
	let best: BusiestSlot | null = null;
	matrix.forEach((row, weekday) => {
		row.forEach((count, hour) => {
			if (count > 0 && (best === null || count > best.count)) {
				best = { weekday, hour, count };
			}
		});
	});
	return best;
}

/**
 * 濃淡の段階を分ける境界を、値の分布から決める。
 *
 * 正の値を小さい順に並べ、等しい割合で区切った位置の値を境界にする。
 * 少数の突出した日に引きずられず、ふだんの差が見えるようにするためである。
 */
export function levelThresholds(
	values: readonly number[],
	levels = 4,
): number[] {
	const positive = values.filter((value) => value > 0).sort((a, b) => a - b);
	if (positive.length === 0) {
		return [];
	}
	const thresholds: number[] = [];
	for (let step = 1; step < levels; step += 1) {
		const position = Math.min(
			positive.length - 1,
			Math.floor((positive.length * step) / levels),
		);
		const value = positive[position];
		if (value !== undefined) {
			thresholds.push(value);
		}
	}
	return thresholds;
}

/**
 * 値を濃淡の段階（0〜境界の数 + 1）に直す。0 は「記録なし」。
 *
 * 境界より大きい値だけが次の段階に上がる。同じ値の日が多くても、
 * もっとも小さい値は必ず段階 1 になる。
 * `active` が true なら、値が 0 でも段階 1 にする。
 */
export function levelOf(
	value: number,
	thresholds: readonly number[],
	active = value > 0,
): number {
	if (value <= 0) {
		return active ? 1 : 0;
	}
	let level = 1;
	for (const threshold of thresholds) {
		if (value > threshold) {
			level += 1;
		}
	}
	return level;
}
