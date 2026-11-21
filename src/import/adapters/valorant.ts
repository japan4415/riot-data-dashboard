import type {
	CurrencyAmount,
	Payment,
	Transaction,
	TransactionKind,
} from "../../model/types.ts";
import type { Adapter } from "../adapter.ts";
import { timestamp } from "../parseDate.ts";
import { asArray, int, isRecord, text } from "../read.ts";
import { spent } from "./shared.ts";

function granted(row: Record<string, unknown>): CurrencyAmount | null {
	const amount = int(row.game_currency_granted);
	if (amount === null) {
		return null;
	}
	return { currency: text(row.game_currency_type) ?? "VP", amount };
}

/** `valorant/valorant_payment_event_uc.json` */
export const valorantPayments: Adapter = (json, context) => {
	const payments: Payment[] = [];

	for (const row of asArray(json)) {
		if (!isRecord(row)) {
			context.skip();
			continue;
		}

		const at = timestamp(row.payment_time_utc);
		const currency = text(row.currency_code)?.toUpperCase() ?? null;
		// 支払額は元データの時点で 100 倍されているので、そのまま読む
		const amountX100 = int(row.real_currency_paid_x100);
		if (at === null || currency === null || amountX100 === null) {
			context.skip();
			continue;
		}

		payments.push({
			game: "valorant",
			id: text(row.player_facing_purchase_id),
			at,
			currency,
			amountX100,
			method: text(row.payment_method),
			granted: granted(row),
			ip: null,
		});
	}

	return { payments };
};

function kind(rawKind: string | null): TransactionKind {
	const lower = rawKind?.toLowerCase();
	return lower === "purchase" || lower === "unlock" ? "purchase" : "other";
}

/** `valorant/valorant_purchase_event_uc.json` */
export const valorantPurchases: Adapter = (json, context) => {
	const transactions: Transaction[] = [];

	for (const row of asArray(json)) {
		const at = isRecord(row) ? timestamp(row.purchase_date) : null;
		if (!isRecord(row) || at === null) {
			context.skip();
			continue;
		}

		const rawKind = text(row.transaction_type);

		transactions.push({
			game: "valorant",
			id: text(row.transaction_id),
			at,
			kind: kind(rawKind),
			rawKind,
			// 先頭に空白が付く値があるが、text() が取り除く
			source: text(row.transaction_source),
			item: {
				// 品目名に改行が混じることがあるが、text() が空白 1 つにまとめる
				name: text(row.item_name),
				rawId: null,
				category: text(row.item_type),
				quantity: null,
			},
			deltas: spent(
				text(row.spent_currency_name),
				int(row.spent_currency_amount),
			),
			balances: [],
			refunded: null,
			ip: null,
		});
	}

	return { transactions };
};
