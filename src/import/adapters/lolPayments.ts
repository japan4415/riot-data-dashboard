import type { Payment } from "../../model/types.ts";
import type { Adapter } from "../adapter.ts";
import { timestamp } from "../parseDate.ts";
import { amountX100, asArray, isRecord, text } from "../read.ts";
import { ipAddress } from "./shared.ts";

/** `leagueoflegends/rp_purchase_history_uc.json` */
export const lolPayments: Adapter = (json, context) => {
	const payments: Payment[] = [];

	for (const row of asArray(json)) {
		const at = isRecord(row) ? timestamp(row.created) : null;
		const currency = isRecord(row)
			? (text(row.currency_type)?.toUpperCase() ?? null)
			: null;
		// 金額は `"12.0"` や `"1300.00"` のような文字列で、桁数がそろっていない
		const amount = isRecord(row) ? amountX100(row.amount) : null;
		if (!isRecord(row) || at === null || currency === null || amount === null) {
			context.skip();
			continue;
		}

		payments.push({
			game: "lol",
			id: text(row.transaction_id),
			at,
			currency,
			amountX100: amount,
			method: text(row.payment_type),
			// この記録には、付与された RP の量が無い（ストア取引の側にある）
			granted: null,
			ip: ipAddress(row.user_ip),
		});
	}

	return { payments };
};
