import type { GameId, ReportCount } from "../../model/types.ts";
import type { Adapter } from "../adapter.ts";
import { int, isRecord } from "../read.ts";

const DIRECTIONS = [
	["reports_made", "made"],
	["reports_received", "received"],
] as const;

/**
 * `leagueoflegends/grouped_reports.json`、`teamfighttactics/tft_grouped_reports.json`、
 * `valorant/valorant_grouped_reports.json`
 *
 * 3 つのファイルは形が同じで、ゲームだけが違うので、ゲームを受け取って変換関数を作る。
 */
export function groupedReports(game: GameId): Adapter {
	return (json, context) => {
		const reports: ReportCount[] = [];
		if (!isRecord(json)) {
			return { reports };
		}

		for (const [field, direction] of DIRECTIONS) {
			const group = json[field];
			if (!isRecord(group)) {
				continue;
			}

			// キーが通報の分類、値が件数。該当が無いときは空オブジェクトになる
			for (const [rawCategory, value] of Object.entries(group)) {
				const category = rawCategory.trim();
				const count = int(value);
				if (category === "" || count === null || count < 0) {
					context.skip();
					continue;
				}
				reports.push({ game, direction, category, count });
			}
		}

		return { reports };
	};
}
