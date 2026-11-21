import type { ChatMessage, ChatPhase } from "../../model/types.ts";
import type { Adapter } from "../adapter.ts";
import { epochMs, parseDateTime } from "../parseDate.ts";
import { body, int, isRecord, text } from "../read.ts";

/** `chat_logs` の中の配列の名前と、発言の局面の対応。この順に並べる。 */
const PHASES: ReadonlyArray<readonly [string, ChatPhase]> = [
	["pre_game", "preGame"],
	["in_game", "inGame"],
	["post_game", "postGame"],
];

/** 試合 ID を読む。元データでは数値だが、空でない文字列も受け付ける。 */
function readGameId(value: unknown): string | null {
	const number = int(value);
	return number !== null ? String(number) : text(value);
}

/**
 * LoL と TFT のチャットログ。
 *
 * - `leagueoflegends/chat_logs_v2_uc/successes/<game_id>.json`
 * - `teamfighttactics/tft_chat_logs_v2_uc/successes/<game_id>.json`
 *
 * 1 ファイルが 1 試合で、ファイル全体が 1 つのオブジェクトになっている。
 */
export function chatLog(game: "lol" | "tft"): Adapter {
	return (json, context) => {
		const gameId = isRecord(json) ? readGameId(json.game_id) : null;
		if (!isRecord(json) || gameId === null) {
			context.skip();
			return { chatLogs: [] };
		}

		const messages: ChatMessage[] = [];
		const logs = isRecord(json.chat_logs) ? json.chat_logs : {};
		for (const [key, phase] of PHASES) {
			const rows = logs[key];
			if (!Array.isArray(rows)) {
				continue;
			}
			for (const row of rows) {
				const message = isRecord(row) ? body(row.chat) : null;
				if (!isRecord(row) || message === null) {
					context.skip();
					continue;
				}
				messages.push({
					phase,
					at: epochMs(row.timestamp),
					sender: text(row.riot_id),
					sentTo: text(row.sent_to),
					text: message,
				});
			}
		}

		// LoL の試合日は日付だけ、TFT は日時になっている
		const matchDate = parseDateTime(json.match_date_utc);

		return {
			chatLogs: [
				{
					game,
					gameId,
					matchDate: matchDate?.at ?? null,
					matchDateIsDateOnly: matchDate?.dateOnly ?? false,
					platform: text(json.platform_id),
					messages,
				},
			],
		};
	};
}
