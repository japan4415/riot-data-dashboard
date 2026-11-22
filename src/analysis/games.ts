import type { Dataset, GameId } from "../model/types.ts";

/**
 * 専用の画面を持つゲーム。メニューにもこの順で並べる。
 *
 * TFT は試合履歴も購入の記録も開示データに無いので、専用の画面を作らない。
 */
export const GAME_SCREENS = [
	"lol",
	"valorant",
	"lor",
	"wildrift",
] as const satisfies readonly GameId[];

export type GameScreen = (typeof GAME_SCREENS)[number];

/** 画面に出せる記録が 1 件でもあるゲームを返す。 */
export function gameScreens(dataset: Dataset): GameScreen[] {
	const games = new Set<GameId>();
	// LoL は、試合履歴が無いのでストアの取引だけを見る
	for (const item of dataset.matches) games.add(item.game);
	for (const item of dataset.transactions) games.add(item.game);
	for (const item of dataset.inventory) games.add(item.game);
	for (const item of dataset.balances) games.add(item.game);
	return GAME_SCREENS.filter((game) => games.has(game));
}
