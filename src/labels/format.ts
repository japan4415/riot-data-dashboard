import {
	type DayKey,
	dayKeyParts,
	type ToLocal,
	weekdayOfDay,
} from "../analysis/localTime.ts";
import type { MoneyTotal, Span } from "../analysis/overview.ts";
import type { EpochMs } from "../model/types.ts";
import { WEEKDAY_LABELS } from "./activity.ts";

const numberFormat = new Intl.NumberFormat("ja-JP");
const percentFormat = new Intl.NumberFormat("ja-JP", {
	style: "percent",
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
});

export function formatNumber(value: number): string {
	return numberFormat.format(value);
}

/** 符号を必ず付けた数。負の数には、ハイフンではなく負符号を使う。 */
export function formatSigned(value: number): string {
	if (value === 0) {
		return "±0";
	}
	return `${value > 0 ? "+" : "−"}${formatNumber(Math.abs(value))}`;
}

export function formatPercent(ratio: number): string {
	return percentFormat.format(ratio);
}

/** 数値と単位の組。数値を大きく、単位を小さく見せる枠に渡す。 */
export interface Quantity {
	value: string;
	unit?: string;
}

/** 時間の長さ。1 時間以上は時間で、それ未満は分で表す。 */
export function durationQuantity(seconds: number): Required<Quantity> {
	return seconds >= 3600
		? { value: formatNumber(Math.round(seconds / 3600)), unit: "時間" }
		: { value: formatNumber(Math.round(seconds / 60)), unit: "分" };
}

export function formatDuration(seconds: number): string {
	const { value, unit } = durationQuantity(seconds);
	return `${value} ${unit}`;
}

/** 1 試合の長さなど、短い時間。例: `24 分`、`1 時間 5 分` */
export function minutesQuantity(seconds: number): Quantity {
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) {
		return { value: formatNumber(minutes), unit: "分" };
	}
	return {
		value: `${formatNumber(Math.floor(minutes / 60))} 時間 ${minutes % 60} 分`,
	};
}

/** 金額。通貨コードが不明なときは、数値とコードを並べる。 */
export function formatMoney(total: MoneyTotal): string {
	const amount = total.amountX100 / 100;
	try {
		return new Intl.NumberFormat("ja-JP", {
			style: "currency",
			currency: total.currency,
		}).format(amount);
	} catch {
		return `${formatNumber(amount)} ${total.currency}`;
	}
}

/** 例: `2024年3月2日（土）` */
export function formatDay(day: DayKey): string {
	const { year, month, day: date } = dayKeyParts(day);
	return `${year}年${month}月${date}日（${WEEKDAY_LABELS[weekdayOfDay(day)]}）`;
}

/** 例: `2024年3月2日` */
export function formatDayShort(day: DayKey): string {
	const { year, month, day: date } = dayKeyParts(day);
	return `${year}年${month}月${date}日`;
}

/** 利用者の時刻での日付と時刻。例: `2024年3月2日 19:05` */
export function formatDateTime(at: EpochMs, toLocal: ToLocal): string {
	const local = toLocal(at);
	const minute = String(local.minute).padStart(2, "0");
	return `${local.year}年${local.month}月${local.day}日 ${local.hour}:${minute}`;
}

/** 利用者の時刻での日付。例: `2024年3月2日` */
export function formatDate(at: EpochMs, toLocal: ToLocal): string {
	const local = toLocal(at);
	return `${local.year}年${local.month}月${local.day}日`;
}

/** 例: `2012 年 9 月 〜 2026 年 11 月` */
export function formatSpan(span: Span, toLocal: ToLocal): string {
	const first = toLocal(span.first);
	const last = toLocal(span.last);
	return `${first.year} 年 ${first.month} 月 〜 ${last.year} 年 ${last.month} 月`;
}

/** 例: `土曜 21 時台` */
export function formatSlot(weekday: number, hour: number): string {
	return `${WEEKDAY_LABELS[weekday]}曜 ${hour} 時台`;
}
