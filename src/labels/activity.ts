import type { ActivityGroup } from "../analysis/activity.ts";

export const ACTIVITY_GROUP_LABELS: Readonly<Record<ActivityGroup, string>> = {
	"lol-tft-pc": "LoL / TFT（PC）",
	valorant: "VALORANT",
	"tft-mobile": "TFT（モバイルほか）",
	wildrift: "Wild Rift",
	lor: "Legends of Runeterra",
};

/**
 * 区分ごとの図表の色。色は区分に固定で、表示する区分が減っても塗り替えない。
 */
export const ACTIVITY_GROUP_COLORS: Readonly<Record<ActivityGroup, string>> = {
	"lol-tft-pc": "var(--chart-series-1)",
	valorant: "var(--chart-series-2)",
	"tft-mobile": "var(--chart-series-3)",
	wildrift: "var(--chart-series-4)",
	lor: "var(--chart-series-5)",
};

/** 濃淡の段階（0〜4）に対応する色。 */
export const LEVEL_COLORS: readonly string[] = [
	"var(--chart-level-0)",
	"var(--chart-level-1)",
	"var(--chart-level-2)",
	"var(--chart-level-3)",
	"var(--chart-level-4)",
];

export const WEEKDAY_LABELS: readonly string[] = [
	"日",
	"月",
	"火",
	"水",
	"木",
	"金",
	"土",
];
