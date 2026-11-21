import type {
	CurrencyBalance,
	InventoryCategory,
	InventoryItem,
	QueueCategory,
	Transaction,
	TransactionKind,
	WildRiftMatch,
} from "../../model/types.ts";
import type { Adapter } from "../adapter.ts";
import { timestamp } from "../parseDate.ts";
import { asArray, int, isRecord, known, text } from "../read.ts";
import { durationSec, outcome, spent } from "./shared.ts";

function category(mode: string | null, type: string | null): QueueCategory {
	const lowerType = type?.toLowerCase() ?? "";
	if (
		mode?.toLowerCase().startsWith("tutorial") ||
		lowerType === "ai" ||
		lowerType === "co-op vs. ai"
	) {
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

/** `wildrift/wildrift_match_history_uc.json` */
export const wildriftMatches: Adapter = (json, context) => {
	const matches: WildRiftMatch[] = [];

	for (const row of asArray(json)) {
		const id = isRecord(row) ? text(row.game_id) : null;
		if (!isRecord(row) || id === null) {
			context.skip();
			continue;
		}

		// 開始と終了は null のことがあるが、試合は残す
		const startedAt = timestamp(row.game_start_time_utc);
		const endedAt = timestamp(row.game_end_time_utc);
		const rawMode = known(row.game_mode);
		const rawType = known(row.game_type);
		const queueCategory = category(rawMode, rawType);
		// `Noncompetitive` は outcome() が `none` にする
		const result = outcome(row.game_outcome);

		matches.push({
			game: "wildrift",
			id,
			startedAt,
			endedAt,
			durationSec: durationSec(startedAt, endedAt),
			queue: { category: queueCategory, rawMode, rawType },
			outcome: result,
			countsForWinRate: result !== "none" && queueCategory !== "practice",
			rank: known(row.player_rank),
			accountLevel: int(row.account_level),
		});
	}

	return { matches };
};

const CURRENCY_NAMES: ReadonlyArray<readonly [string, string]> = [
	["blue_motes", "Blue Motes"],
	["poro_coins", "Poro Coins"],
	["wild_cores", "Wild Cores"],
];

/** `wildrift/wildrift_currency.json`（値は数値の文字列） */
export const wildriftCurrency: Adapter = (json, context) => {
	const balances: CurrencyBalance[] = [];

	if (!isRecord(json)) {
		context.skip();
		return { balances };
	}

	for (const [key, currency] of CURRENCY_NAMES) {
		const amount = int(json[key]);
		if (amount !== null) {
			balances.push({ game: "wildrift", currency, amount });
		}
	}

	return { balances };
};

/** 名前だけの文字列配列から作る所持品。`champions` は先頭に並べるため別に扱う。 */
const CHAMPION_KEY = "champions";
const OTHER_NAME_LISTS: ReadonlyArray<readonly [string, InventoryCategory]> = [
	["emotes", "emote"],
	["summoner_icons", "icon"],
	["icon_borders", "iconBorder"],
	["banners", "banner"],
	["baubles", "bauble"],
];

/**
 * スキンの名前とチャンピオン名を、正しい向きで読む。
 *
 * 元データでは 2 つの項目が入れ替わっていて、`champion_name` にスキン名
 * （例: `Spellthief Lux`）、`skin_name` にチャンピオン名（例: `Lux`）が入っている。
 * 正しい向きで出力されても読めるように、向きは次の性質で判定する。
 * スキン名はチャンピオン名を含み、かつそれより長い。
 * - `champion_name` が `skin_name` を含み、より長い: 入れ替わっているとみなす
 * - それ以外: 項目名のとおりに読む
 */
function skin(row: Record<string, unknown>): InventoryItem | null {
	const championField = text(row.champion_name);
	const skinField = text(row.skin_name);

	const swapped =
		championField !== null &&
		skinField !== null &&
		championField.length > skinField.length &&
		championField.includes(skinField);

	const name = swapped ? championField : skinField;
	const detail = swapped ? skinField : championField;
	if (name === null) {
		return null;
	}
	return { game: "wildrift", category: "skin", name, detail, quantity: null };
}

/** `wildrift/wildrift_inventory.json` */
export const wildriftInventory: Adapter = (json, context) => {
	const inventory: InventoryItem[] = [];

	if (!isRecord(json)) {
		context.skip();
		return { inventory };
	}

	const addNames = (key: string, itemCategory: InventoryCategory) => {
		for (const value of asArray(json[key])) {
			const name = text(value);
			if (name === null) {
				context.skip();
				continue;
			}
			inventory.push({
				game: "wildrift",
				category: itemCategory,
				name,
				detail: null,
				quantity: null,
			});
		}
	};

	addNames(CHAMPION_KEY, "champion");

	for (const row of asArray(json.skins)) {
		const item = isRecord(row) ? skin(row) : null;
		if (item === null) {
			context.skip();
			continue;
		}
		inventory.push(item);
	}

	for (const [key, itemCategory] of OTHER_NAME_LISTS) {
		addNames(key, itemCategory);
	}

	for (const row of asArray(json.backpack)) {
		const name = isRecord(row) ? text(row.name) : null;
		if (!isRecord(row) || name === null) {
			context.skip();
			continue;
		}
		inventory.push({
			game: "wildrift",
			category: "consumable",
			name,
			detail: null,
			quantity: int(row.quantity),
		});
	}

	return { inventory };
};

function kind(rawKind: string | null): TransactionKind {
	return rawKind?.toLowerCase() === "purchase" ? "purchase" : "other";
}

/** `wildrift/wildrift_purchase_event_uc.json` */
export const wildriftPurchases: Adapter = (json, context) => {
	const transactions: Transaction[] = [];

	for (const row of asArray(json)) {
		const at = isRecord(row) ? timestamp(row.purchase_date) : null;
		if (!isRecord(row) || at === null) {
			context.skip();
			continue;
		}

		const rawKind = text(row.transaction_type);

		transactions.push({
			game: "wildrift",
			// 元データでは常に null
			id: text(row.transaction_id),
			at,
			kind: kind(rawKind),
			rawKind,
			source: text(row.transaction_source),
			item: {
				// 品目名が null の行がある
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
