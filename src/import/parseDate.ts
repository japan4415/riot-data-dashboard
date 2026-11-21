import type { EpochMs } from "../model/types.ts";

/**
 * 開示データの日時を UTC のエポックミリ秒に変換する。
 *
 * ファイルごとに書式が違い、同じファイルの中でも混在する。
 * 対応する書式は `docs/data-structure.md` の「日時の書式」のとおり。
 *
 * - `2020-01-02 03:04:05`（末尾の小数秒は 1〜9 桁まで）
 * - `2020-01-02T03:04:05.123456+00:00` / `+0000` / `Z`
 * - `2020-01-02`（日付のみ）
 *
 * タイムゾーンの記載が無い値は UTC とみなす。
 */

export interface ParsedDateTime {
	at: EpochMs;
	/** 時刻を持たず、日付だけだった場合に true。 */
	dateOnly: boolean;
}

const DATE_TIME_PATTERN =
	/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?\s*(Z|[+-]\d{2}:?\d{2})?)?$/;

function offsetMinutes(zone: string | undefined): number {
	if (zone === undefined || zone === "Z") {
		return 0;
	}
	const sign = zone.startsWith("-") ? -1 : 1;
	const digits = zone.slice(1).replace(":", "");
	const hours = Number(digits.slice(0, 2));
	const minutes = Number(digits.slice(2, 4));
	return sign * (hours * 60 + minutes);
}

export function parseDateTime(value: unknown): ParsedDateTime | null {
	if (typeof value !== "string") {
		return null;
	}
	const match = DATE_TIME_PATTERN.exec(value.trim());
	if (!match) {
		return null;
	}
	const [, y, mo, d, h, mi, s, fraction, zone] = match;
	const year = Number(y);
	const month = Number(mo);
	const day = Number(d);
	const dateOnly = h === undefined;
	const hour = Number(h ?? 0);
	const minute = Number(mi ?? 0);
	const second = Number(s ?? 0);
	const millisecond = fraction
		? Number(fraction.padEnd(3, "0").slice(0, 3))
		: 0;

	const utc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
	// Date.UTC は範囲外の値を繰り上げてしまうので、元の値に戻るかで妥当性を確かめる
	const check = new Date(utc);
	if (
		check.getUTCFullYear() !== year ||
		check.getUTCMonth() !== month - 1 ||
		check.getUTCDate() !== day ||
		check.getUTCHours() !== hour ||
		check.getUTCMinutes() !== minute ||
		check.getUTCSeconds() !== second
	) {
		return null;
	}

	return { at: utc - offsetMinutes(zone) * 60_000, dateOnly };
}

/** 日時を読む。読めない値は null。 */
export function timestamp(value: unknown): EpochMs | null {
	return parseDateTime(value)?.at ?? null;
}

/** Unix 時刻（ミリ秒）の数値を読む。 */
export function epochMs(value: unknown): EpochMs | null {
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
		return null;
	}
	return Math.trunc(value);
}
