import {
	type DayKey,
	dayKeyParts,
	type ToLocal,
	weekdayOfDay,
} from "../analysis/localTime.ts";
import type { MoneyTotal, Span } from "../analysis/overview.ts";
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

export function formatPercent(ratio: number): string {
	return percentFormat.format(ratio);
}

/** 時間の長さ。1 時間以上は時間で、それ未満は分で表す。 */
export function formatDuration(seconds: number): string {
	if (seconds >= 3600) {
		return `${formatNumber(Math.round(seconds / 3600))} 時間`;
	}
	return `${formatNumber(Math.round(seconds / 60))} 分`;
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
