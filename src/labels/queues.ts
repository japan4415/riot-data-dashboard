import type { QueueCategory } from "../model/types.ts";

export const QUEUE_CATEGORY_LABELS: Readonly<Record<QueueCategory, string>> = {
	ranked: "ランク",
	normal: "通常",
	other: "その他の対戦",
	custom: "カスタム",
	practice: "練習",
};

/**
 * 区分ごとの図表の色。色は区分に固定で、表示する区分が減っても塗り替えない。
 * 練習は図に出さないが、区分の数だけ色を持っておく。
 */
export const QUEUE_CATEGORY_COLORS: Readonly<Record<QueueCategory, string>> = {
	ranked: "var(--chart-series-1)",
	normal: "var(--chart-series-2)",
	other: "var(--chart-series-3)",
	custom: "var(--chart-series-4)",
	practice: "var(--chart-series-5)",
};

/**
 * 内部のコード名と思われる種別の、表示名。
 *
 * 開示データには `Ranked` のような一般的な名前と、`Hurm` のようなコード名が混ざっている。
 * 一般的な名前はそのまま表示し、対応が分かっているコード名だけを置き換える。
 * 対応が分からないもの（`Fortcollins` など）は、元の値のまま表示する。
 *
 * 元データの文字列で引くので、オブジェクトではなく Map にする
 * （`constructor` などの名前に反応させない）。
 */
const CODE_NAMES: ReadonlyMap<string, string> = new Map([
	["hurm", "Team Deathmatch"],
	["ggteam", "Escalation"],
	["onefa", "Replication"],
	["newmap", "New Map"],
]);

export interface QueueLabel {
	label: string;
	/** 表示名に置き換えたときの、元の値。置き換えていなければ null。 */
	raw: string | null;
}

/** 種別の表示名。名前の記録が無いものは「種別の記録なし」とする。 */
export function queueLabel(name: string | null): QueueLabel {
	if (name === null) {
		return { label: "種別の記録なし", raw: null };
	}
	const display = CODE_NAMES.get(name.toLowerCase());
	return display === undefined
		? { label: name, raw: null }
		: { label: display, raw: name };
}

/** 表示名と元の値を 1 つの文字列にする。例: `Team Deathmatch（Hurm）` */
export function queueText(name: string | null): string {
	const { label, raw } = queueLabel(name);
	return raw === null ? label : `${label}（${raw}）`;
}
