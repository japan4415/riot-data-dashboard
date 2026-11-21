import type {
	LorMatch,
	Payment,
	QueueCategory,
	Transaction,
} from "../../model/types.ts";
import type { Adapter } from "../adapter.ts";
import { timestamp } from "../parseDate.ts";
import { asArray, int, isRecord, known, text } from "../read.ts";
import { durationSec, outcome, spent } from "./shared.ts";

function category(mode: string | null, type: string | null): QueueCategory {
	const lowerType = type?.toLowerCase() ?? "";
	if (mode?.toLowerCase().startsWith("tutorial") || lowerType === "ai") {
		return "practice";
	}
	if (lowerType === "ranked") {
		return "ranked";
	}
	if (lowerType === "normal") {
		return "normal";
	}
	return "other";
}

/**
 * `legendsofruneterra/lor_match_history_uc.json`
 *
 * 元データの `is_ai` は、`game_type` が `AI` の行でも false になるので読まない。
 * 対 AI 戦かどうかは `game_type` と `game_mode` で判定する。
 */
export const lorMatches: Adapter = (json, context) => {
	const matches: LorMatch[] = [];

	for (const row of asArray(json)) {
		const id = isRecord(row) ? text(row.game_id) : null;
		if (!isRecord(row) || id === null) {
			context.skip();
			continue;
		}

		const startedAt = timestamp(row.game_start_time_utc);
		const endedAt = timestamp(row.game_end_time_utc);
		// 試合時間が 0 の行があるので、正の値のときだけ採用し、それ以外は日時から求める
		const recorded = int(row.game_time_seconds);
		const rawMode = known(row.game_mode);
		const rawType = known(row.game_type);
		const queueCategory = category(rawMode, rawType);
		// 練習の試合も、記録された勝敗はそのまま保つ
		const result = outcome(row.game_outcome);

		matches.push({
			game: "lor",
			id,
			startedAt,
			endedAt,
			durationSec:
				recorded !== null && recorded > 0
					? recorded
					: durationSec(startedAt, endedAt),
			queue: { category: queueCategory, rawMode, rawType },
			outcome: result,
			countsForWinRate: result !== "none" && queueCategory !== "practice",
			deckId: known(row.deck_id),
			// `Unknown` は値なしを表すので含めない
			factions: [row.faction1, row.faction2, row.faction3].flatMap((value) => {
				const faction = known(value);
				return faction === null ? [] : [faction];
			}),
			turnCount: int(row.total_turn_count),
			outcomeReason: known(row.game_outcome_reason),
			platform: known(row.platform),
			orderOfPlay: int(row.order_of_play),
			realm: known(row.realm_id),
		});
	}

	return { matches };
};

/** `legendsofruneterra/lor_payment_history_event_uc.json` */
export const lorPayments: Adapter = (json, context) => {
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

		const grantedAmount = int(row.game_currency_granted);

		payments.push({
			game: "lor",
			id: text(row.player_facing_purchase_id),
			at,
			currency,
			amountX100,
			method: text(row.payment_method),
			// LoR の付与通貨は元データに種類の項目が無く、常にコイン
			granted:
				grantedAmount === null
					? null
					: { currency: "Coins", amount: grantedAmount },
			ip: null,
		});
	}

	return { payments };
};

/** `legendsofruneterra/lor_purchase_history_event_uc.json` */
export const lorPurchases: Adapter = (json, context) => {
	const transactions: Transaction[] = [];

	for (const row of asArray(json)) {
		const at = isRecord(row) ? timestamp(row.purchase_time_utc) : null;
		if (!isRecord(row) || at === null) {
			context.skip();
			continue;
		}

		const currency = text(row.spent_item_name) ?? text(row.spent_item_type);
		const newBalance = int(row.spent_item_new_balance);

		transactions.push({
			game: "lor",
			// 同じ取引 ID を持つ行が複数ある（品目ごとの行と見られる）ので、すべて残す
			id: text(row.transaction_id),
			at,
			kind: "purchase",
			rawKind: null,
			source: text(row.transaction_source),
			item: {
				name: text(row.purchased_item_name),
				rawId: null,
				category: text(row.purchased_item_type),
				quantity: int(row.purchased_item_amount),
			},
			deltas: spent(currency, int(row.spent_item_amount)),
			balances:
				currency !== null && newBalance !== null
					? [{ currency, amount: newBalance }]
					: [],
			refunded: null,
			ip: null,
		});
	}

	return { transactions };
};
