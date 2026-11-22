import type { EpochMs } from "../model/types.ts";

/**
 * 時刻を、利用者のタイムゾーンでの暦の値に直すための関数群。
 *
 * データは UTC で持つが、「何曜日の何時に遊んだか」は利用者の時刻で数える。
 * 集計の関数は `ToLocal` を引数で受け取るので、テストでは固定のずれを使える。
 */

export interface LocalParts {
	year: number;
	/** 1〜12 */
	month: number;
	day: number;
	/** 0 = 日曜、6 = 土曜 */
	weekday: number;
	/** 0〜23 */
	hour: number;
	/** 0〜59 */
	minute: number;
}

export type ToLocal = (at: EpochMs) => LocalParts;

/** ブラウザのタイムゾーンで暦の値を求める。 */
export const browserLocal: ToLocal = (at) => {
	const date = new Date(at);
	return {
		year: date.getFullYear(),
		month: date.getMonth() + 1,
		day: date.getDate(),
		weekday: date.getDay(),
		hour: date.getHours(),
		minute: date.getMinutes(),
	};
};

/** UTC から一定の分だけずれたタイムゾーンで暦の値を求める。日本時間は 540。 */
export function fixedOffset(offsetMinutes: number): ToLocal {
	return (at) => {
		const date = new Date(at + offsetMinutes * 60_000);
		return {
			year: date.getUTCFullYear(),
			month: date.getUTCMonth() + 1,
			day: date.getUTCDate(),
			weekday: date.getUTCDay(),
			hour: date.getUTCHours(),
			minute: date.getUTCMinutes(),
		};
	};
}

/** 暦の日付を表す `YYYYMMDD` の整数。大小の比較がそのまま日付の前後になる。 */
export type DayKey = number;

const MS_PER_DAY = 86_400_000;

export function dayKeyOf(parts: {
	year: number;
	month: number;
	day: number;
}): DayKey {
	return parts.year * 10_000 + parts.month * 100 + parts.day;
}

export function dayKeyParts(key: DayKey): {
	year: number;
	month: number;
	day: number;
} {
	return {
		year: Math.floor(key / 10_000),
		month: Math.floor(key / 100) % 100,
		day: key % 100,
	};
}

/** 日付を通し番号にする。連続した日は番号が 1 ずつ増える。 */
export function dayNumber(key: DayKey): number {
	const { year, month, day } = dayKeyParts(key);
	return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

export function dayKeyFromNumber(number: number): DayKey {
	const date = new Date(number * MS_PER_DAY);
	return dayKeyOf({
		year: date.getUTCFullYear(),
		month: date.getUTCMonth() + 1,
		day: date.getUTCDate(),
	});
}

/** 日付の曜日。0 = 日曜。 */
export function weekdayOfDay(key: DayKey): number {
	return new Date(dayNumber(key) * MS_PER_DAY).getUTCDay();
}

/** UTC とのずれとして考えられる最大の幅（−12 時間〜+14 時間）に、余裕を足したもの。 */
const MAX_OFFSET_MS = 15 * 3_600_000;

/**
 * 利用者のタイムゾーンで、その月が始まる時刻を求める。
 *
 * `month` は 1〜12 のほか、13 以上も受け付ける（13 は翌年の 1 月）。
 * `ToLocal` は時刻から暦への変換しか持たないので、暦が切り替わる時刻を二分探索で探す。
 */
export function startOfMonth(
	year: number,
	month: number,
	toLocal: ToLocal,
): EpochMs {
	const targetYear = year + Math.floor((month - 1) / 12);
	const targetMonth = ((month - 1) % 12) + 1;
	const reached = (at: EpochMs) => {
		const local = toLocal(at);
		return (
			local.year > targetYear ||
			(local.year === targetYear && local.month >= targetMonth)
		);
	};

	const utc = Date.UTC(targetYear, targetMonth - 1, 1);
	let low = utc - MAX_OFFSET_MS;
	let high = utc + MAX_OFFSET_MS;
	while (high - low > 1) {
		const middle = Math.floor((low + high) / 2);
		if (reached(middle)) {
			high = middle;
		} else {
			low = middle;
		}
	}
	return high;
}

export function startOfYear(year: number, toLocal: ToLocal): EpochMs {
	return startOfMonth(year, 1, toLocal);
}
