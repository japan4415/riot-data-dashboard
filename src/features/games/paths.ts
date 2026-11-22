import type { GameScreen } from "../../analysis/games.ts";

/** ゲームごとの画面のパス。 */
export const GAME_PATHS: Readonly<Record<GameScreen, string>> = {
	lol: "/lol",
	valorant: "/valorant",
	lor: "/lor",
	wildrift: "/wildrift",
};
