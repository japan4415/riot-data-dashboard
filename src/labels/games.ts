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

export function gameLabel(game: GameId | null): string {
	return game === null ? "アカウント" : GAME_LABELS[game];
}
