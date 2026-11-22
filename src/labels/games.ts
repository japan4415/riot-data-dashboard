import type { GameId } from "../model/types.ts";

const GAME_LABELS: Readonly<Record<GameId, string>> = {
	lol: "League of Legends",
	tft: "Teamfight Tactics",
	valorant: "VALORANT",
	lor: "Legends of Runeterra",
	wildrift: "Wild Rift",
	"2xko": "2XKO",
};

/** 画面に並べる順。null はアカウント全体に関わるデータ。 */
export const GAME_ORDER: ReadonlyArray<GameId | null> = [
	null,
	"lol",
	"tft",
	"valorant",
	"lor",
	"wildrift",
	"2xko",
];

/** ゲームを並べる順。`GAME_ORDER` から、アカウント全体を除いたもの。 */
export const GAMES: readonly GameId[] = GAME_ORDER.filter(
	(game): game is GameId => game !== null,
);

/**
 * ゲームごとの図表の色。活動の区分と同じ色を使い、画面をまたいで意味をそろえる。
 * 検証済みの系列の色は 5 つなので、6 つめの 2XKO には地味な色を当てる。
 */
export const GAME_COLORS: Readonly<Record<GameId, string>> = {
	lol: "var(--chart-series-1)",
	valorant: "var(--chart-series-2)",
	tft: "var(--chart-series-3)",
	wildrift: "var(--chart-series-4)",
	lor: "var(--chart-series-5)",
	"2xko": "var(--chart-axis)",
};

/** 図表でゲームを積む順。色の並びが、検証した順（系列 1〜5）になるようにする。 */
export const GAME_SERIES_ORDER: readonly GameId[] = [
	"lol",
	"valorant",
	"tft",
	"wildrift",
	"lor",
	"2xko",
];

export function gameLabel(game: GameId | null): string {
	return game === null ? "アカウント" : GAME_LABELS[game];
}
