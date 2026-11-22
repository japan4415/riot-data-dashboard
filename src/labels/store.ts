import type { GiftDirection, PaidWith } from "../analysis/store.ts";
import type {
	CurrencyAmount,
	InventoryCategory,
	TransactionItem,
	TransactionKind,
} from "../model/types.ts";
import { formatNumber, formatSigned } from "./format.ts";

export const TRANSACTION_KIND_LABELS: Readonly<
	Record<TransactionKind, string>
> = {
	purchase: "購入",
	topUp: "通貨の購入",
	giftSent: "贈った",
	giftReceived: "受け取った",
	refund: "返金",
	reward: "報酬",
	other: "その他",
};

/** 取引の種類を、絞り込みの選択肢に並べる順。 */
export const TRANSACTION_KINDS = [
	"purchase",
	"topUp",
	"giftSent",
	"giftReceived",
	"refund",
	"reward",
	"other",
] as const satisfies readonly TransactionKind[];

export const GIFT_DIRECTION_LABELS: Readonly<Record<GiftDirection, string>> = {
	sent: "贈った",
	received: "受け取った",
};

/** LoL の品目の区分。品目 ID の接頭辞から推定したもの。 */
const LOL_ITEM_CATEGORY_LABELS: Readonly<Record<string, string>> = {
	champion: "チャンピオン",
	skin: "スキン",
	summonerIcon: "サモナーアイコン",
	emote: "エモート",
	wardSkin: "ワードスキン",
	rune: "ルーン",
	hextechCrafting: "ヘクステッククラフト",
	boost: "ブースト",
	bundle: "バンドル",
	rp: "RP",
	currency: "通貨",
	summoner: "サモナー関連",
	tftDamageSkin: "TFT のダメージ演出",
	eventPass: "イベントパス",
	accountTransfer: "アカウント移行",
};

export function lolItemCategoryLabel(category: string | null): string {
	if (category === null) {
		return "区分不明";
	}
	return LOL_ITEM_CATEGORY_LABELS[category] ?? category;
}

export const PAID_WITH_LABELS: Readonly<Record<PaidWith, string>> = {
	rp: "RP で購入",
	be: "ブルーエッセンスで購入",
	none: "通貨の増減なし",
};

export const PAID_WITH_COLORS: Readonly<Record<PaidWith, string>> = {
	rp: "var(--chart-series-1)",
	be: "var(--chart-series-2)",
	none: "var(--chart-series-3)",
};

export const INVENTORY_CATEGORY_LABELS: Readonly<
	Record<InventoryCategory, string>
> = {
	champion: "チャンピオン",
	skin: "スキン",
	emote: "エモート",
	icon: "アイコン",
	iconBorder: "アイコン枠",
	banner: "バナー",
	bauble: "飾り",
	consumable: "消耗品",
};

/** 通貨の表示名。LoL の `BE` はブルーエッセンスと書く。 */
export function currencyLabel(currency: string): string {
	return currency === "BE" ? "ブルーエッセンス" : currency;
}

/** 通貨の増減を 1 つの文字列にする。例: `−975 RP`。増減が無ければ `—`。 */
export function formatDeltas(deltas: readonly CurrencyAmount[]): string {
	if (deltas.length === 0) {
		return "—";
	}
	return deltas
		.map((delta) => `${formatSigned(delta.amount)} ${delta.currency}`)
		.join("、");
}

/** 支払った通貨を、符号を付けずに表す。例: `975 RP`。支払いが無ければ `—`。 */
export function formatSpent(deltas: readonly CurrencyAmount[]): string {
	const spent = deltas.filter((delta) => delta.amount < 0);
	if (spent.length === 0) {
		return "—";
	}
	return spent
		.map((delta) => `${formatNumber(-delta.amount)} ${delta.currency}`)
		.join("、");
}

/**
 * 品目の名前。名前が無く ID だけがある品目（LoL）は、ID をそのまま返す。
 * どちらも無ければ `—`。
 */
export function itemName(item: TransactionItem): string {
	return item.name ?? item.rawId ?? "—";
}
