import type { CurrencyAmount, EpochMs, Outcome } from "../../model/types.ts";
import { text } from "../read.ts";

/** 開始と終了から長さ（秒）を求める。どちらかが無い、または逆転している場合は null。 */
export function durationSec(
	startedAt: EpochMs | null,
	endedAt: EpochMs | null,
): number | null {
	if (startedAt === null || endedAt === null || endedAt < startedAt) {
		return null;
	}
	return Math.round((endedAt - startedAt) / 1000);
}

/** 勝敗の表記（`Win` / `Loss`、`Victory` / `Defeat`）をそろえる。それ以外は `none`。 */
export function outcome(value: unknown): Outcome {
	switch (text(value)?.toLowerCase()) {
		case "win":
		case "victory":
			return "win";
		case "loss":
		case "defeat":
			return "loss";
		default:
			return "none";
	}
}

const PLACEHOLDER_ADDRESSES = new Set([
	"0.0.0.0",
	"1.1.1.1",
	"127.0.0.1",
	"::1",
]);
const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6_PATTERN = /^[0-9a-f:]+(?:%\w+)?$/i;

/**
 * IP アドレスを読む。
 *
 * `Unknown`、仮の値（`0.0.0.0` など）、ホスト名のような文字列は null にする。
 */
export function ipAddress(value: unknown): string | null {
	const read = text(value);
	if (read === null || PLACEHOLDER_ADDRESSES.has(read)) {
		return null;
	}
	const v4 = IPV4_PATTERN.exec(read);
	if (v4) {
		return v4.slice(1).every((part) => Number(part) <= 255) ? read : null;
	}
	if (read.includes(":") && IPV6_PATTERN.test(read)) {
		return read.toLowerCase();
	}
	return null;
}

/**
 * 支払ったゲーム内通貨を、負の増減として表す。
 * 通貨名が無い、または量が正でない場合は空配列を返す。
 */
export function spent(
	currency: string | null,
	amount: number | null,
): CurrencyAmount[] {
	if (currency === null || amount === null || amount <= 0) {
		return [];
	}
	return [{ currency, amount: -amount }];
}
