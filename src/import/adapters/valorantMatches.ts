import type { QueueCategory, ValorantMatch } from "../../model/types.ts";
import type { Adapter } from "../adapter.ts";
import { timestamp } from "../parseDate.ts";
import { asArray, isRecord, known, text } from "../read.ts";
import { durationSec, outcome } from "./shared.ts";

const PRACTICE_MODES = new Set(["shootingrange", "new player experience"]);
const CUSTOM_MODES = new Set(["custom game", "tournament"]);
const NORMAL_TYPES = new Set(["unrated", "swiftplay"]);

function category(mode: string | null, type: string | null): QueueCategory {
	const lowerMode = mode?.toLowerCase() ?? "";
	const lowerType = type?.toLowerCase() ?? "";
	if (PRACTICE_MODES.has(lowerMode)) {
		return "practice";
	}
	if (CUSTOM_MODES.has(lowerMode)) {
		return "custom";
	}
	if (lowerType === "ranked") {
		return "ranked";
	}
	if (NORMAL_TYPES.has(lowerType)) {
		return "normal";
	}
	return "other";
}

/** `valorant/valorant_match_history_uc.json` */
export const valorantMatches: Adapter = (json, context) => {
	const matches: ValorantMatch[] = [];

	for (const row of asArray(json)) {
		const id = isRecord(row) ? text(row.game_id) : null;
		if (!isRecord(row) || id === null) {
			context.skip();
			continue;
		}

		const startedAt = timestamp(row.game_start_time_utc);
		const endedAt = timestamp(row.game_end_time_utc);
		const rawMode = known(row.game_mode);
		const rawType = known(row.game_type);
		const queueCategory = category(rawMode, rawType);
		// 射撃場などは勝敗がすべて Loss で記録されるので、勝敗なしとして扱う
		const result =
			queueCategory === "practice" ? "none" : outcome(row.game_outcome);

		matches.push({
			game: "valorant",
			id,
			startedAt,
			endedAt,
			durationSec: durationSec(startedAt, endedAt),
			queue: { category: queueCategory, rawMode, rawType },
			outcome: result,
			// Deathmatch は勝敗がほぼすべて Loss で記録されるので、勝率には数えない
			countsForWinRate:
				result !== "none" && rawType?.toLowerCase() !== "deathmatch",
			realm: known(row.realm_id),
		});
	}

	return { matches };
};
