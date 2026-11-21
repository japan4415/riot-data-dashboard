import type {
	CurrencyAmount,
	Transaction,
	TransactionKind,
} from "../../model/types.ts";
import type { Adapter } from "../adapter.ts";
import { timestamp } from "../parseDate.ts";
import { asArray, bool, int, isRecord, text } from "../read.ts";
import { ipAddress } from "./shared.ts";

// 実データでは 2,000 行ほどあるので、対応表は読み込みのたびに作らない
const KINDS: ReadonlyMap<string, TransactionKind> = new Map([
	["PURCHASE", "purchase"],
	["PURCHASE_BUNDLE_ITEM", "purchase"],
	["PURCHASE_NON_REFUNDABLE", "purchase"],
	["MYSTERY_PURCHASE", "purchase"],
	["USER_PURCHASED_RP", "topUp"],
	["USER_PURCHASED_RP_GIFT", "topUp"],
	["PURCHASED_GIFT", "giftSent"],
	["PURCHASED_MYSTERY_GIFT", "giftSent"],
	["ITEM_TRANSFER_SENT", "giftSent"],
	["RP_TRANSFER_SENT", "giftSent"],
	["ITEM_TRANSFER_RECEIVED", "giftReceived"],
	["RP_TRANSFER_RECEIVED", "giftReceived"],
	["REFUND", "refund"],
	["PERK", "reward"],
	["MYSTERY_PERK", "reward"],
	["PROMO_REDEMPTION", "reward"],
	["COMMUNITY_REDEMPTION", "reward"],
	["LEAGUES_REWARD", "reward"],
	["RAF_REWARD", "reward"],
]);

/** `<種別>_<数値>` の種別と、品目の区分の対応。 */
const ITEM_CATEGORIES: ReadonlyMap<string, string> = new Map([
	["champions", "champion"],
	["championsskin", "skin"],
	["summoner_icon", "summonerIcon"],
	["emote", "emote"],
	["wardskin", "wardSkin"],
	["runes", "rune"],
	["hextech_crafting", "hextechCrafting"],
	["boosts", "boost"],
	["rp", "rp"],
	["currency", "currency"],
	["summoner", "summoner"],
	["tft_damage_skins", "tftDamageSkin"],
	["event_pass", "eventPass"],
]);

/**
 * 品目 ID の接頭辞から、品目の区分を求める。
 *
 * 末尾の `_<数値>` を取り除いたものを接頭辞とする。
 * 空の ID や数値だけの ID など、接頭辞から決められないものは null。
 */
export function lolItemCategory(itemId: string | null): string | null {
	if (itemId === null) {
		return null;
	}
	const prefix = itemId.replace(/_\d+$/, "");
	const category = ITEM_CATEGORIES.get(prefix);
	if (category !== undefined) {
		return category;
	}
	// `bundles_<名前>` や `account_transfer_<プラットフォーム>` は末尾が数値と限らない
	if (prefix.startsWith("bundles")) {
		return "bundle";
	}
	if (prefix.startsWith("account_transfer")) {
		return "accountTransfer";
	}
	return null;
}

/** 0 でない整数だけを、通貨の増減として返す。 */
function delta(currency: string, value: unknown): CurrencyAmount[] {
	const amount = int(value);
	return amount === null || amount === 0 ? [] : [{ currency, amount }];
}

/** 整数だけを、通貨の残高として返す。0 も残高として残す。 */
function balance(currency: string, value: unknown): CurrencyAmount[] {
	const amount = int(value);
	return amount === null ? [] : [{ currency, amount }];
}

/** `leagueoflegends/store_transactions_uc.json` */
export const lolStore: Adapter = (json, context) => {
	const transactions: Transaction[] = [];

	for (const row of asArray(json)) {
		const at = isRecord(row) ? timestamp(row.created) : null;
		if (!isRecord(row) || at === null) {
			context.skip();
			continue;
		}

		const rawKind = text(row.type);
		const rawId = text(row.item_id);

		transactions.push({
			game: "lol",
			id: text(row.id),
			at,
			kind: (rawKind === null ? undefined : KINDS.get(rawKind)) ?? "other",
			rawKind,
			source: null,
			item: {
				name: null,
				rawId,
				category: lolItemCategory(rawId),
				quantity: null,
			},
			// `ip_delta` / `ip_balance` は IP アドレスではない。
			// 旧インフルエンスポイント（現ブルーエッセンス、BE）の増減と残高である
			deltas: [...delta("RP", row.rp_delta), ...delta("BE", row.ip_delta)],
			balances: [
				...balance("RP", row.rp_balance),
				...balance("BE", row.ip_balance),
			],
			refunded: bool(row.is_refunded),
			// こちらの `ip_address` は本物の IP アドレス
			ip: ipAddress(row.ip_address),
		});
	}

	return { transactions };
};
