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
