import type { GameId } from "../model/types.ts";
import type { Adapter } from "./adapter.ts";
import {
	accountAuditV1,
	accountAuditV2,
	accountInfo,
	clash,
	summoner,
} from "./adapters/account.ts";
import { chatLog } from "./adapters/chatLogs.ts";
import { logins } from "./adapters/logins.ts";
import { lolPayments } from "./adapters/lolPayments.ts";
import { lolStore } from "./adapters/lolStore.ts";
import { lorMatches, lorPayments, lorPurchases } from "./adapters/lor.ts";
import { penalties } from "./adapters/penalties.ts";
import { groupedReports } from "./adapters/reports.ts";
import { tickets } from "./adapters/tickets.ts";
import { valorantPayments, valorantPurchases } from "./adapters/valorant.ts";
import { valorantMatches } from "./adapters/valorantMatches.ts";
import {
	wildriftCurrency,
	wildriftInventory,
	wildriftMatches,
	wildriftPurchases,
} from "./adapters/wildrift.ts";

/** 開示データに含まれるファイルの種類。 */
export interface FileKind {
	id: string;
	/** 画面に出す名前。 */
	label: string;
	/** どのゲームのデータか。アカウント全体に関わるものは null。 */
	game: GameId | null;
	/** 小文字にそろえたパスに対して照合する。 */
	pattern: RegExp;
	adapter: Adapter;
}

/**
 * パスと変換関数の対応表。
 *
 * ここに無いファイルは「未対応」として読み込み結果に載る。
 * サンプルで中身が空だったファイル（2XKO、音声書き起こしなど）は項目が
 * 分からないので、対応表に入れていない。
 */
export const FILE_KINDS: readonly FileKind[] = [
	{
		id: "account-info",
		label: "アカウント情報",
		game: null,
		pattern: /^riotaccount\/account_info\.json$/,
		adapter: accountInfo,
	},
	{
		id: "account-audit-v1",
		label: "アカウントの変更履歴（旧形式）",
		game: null,
		pattern: /^riotaccount\/account_audit_events_v1_uc\.json$/,
		adapter: accountAuditV1,
	},
	{
		id: "account-audit-v2",
		label: "アカウントの変更履歴",
		game: null,
		pattern: /^riotaccount\/account_audit_events_v2_uc\.json$/,
		adapter: accountAuditV2,
	},
	{
		id: "logins",
		label: "ログイン記録",
		game: null,
		pattern: /^riotaccount\/atlas_login_event_uc\.json$/,
		adapter: logins,
	},
	{
		id: "penalties",
		label: "ペナルティ",
		game: null,
		pattern: /^penalties\/penalty_history\.json$/,
		adapter: penalties,
	},
	{
		id: "tickets",
		label: "問い合わせ",
		game: null,
		pattern: /^zendesk\/zendesk_tickets\.json$/,
		adapter: tickets,
	},
	{
		id: "lol-summoner",
		label: "サモナー情報",
		game: "lol",
		pattern: /^leagueoflegends\/summoner\.json$/,
		adapter: summoner,
	},
	{
		id: "lol-clash",
		label: "Clash の登録情報",
		game: "lol",
		pattern: /^leagueoflegends\/clash\.json$/,
		adapter: clash,
	},
	{
		id: "lol-store",
		label: "ストアの取引",
		game: "lol",
		pattern: /^leagueoflegends\/store_transactions_uc\.json$/,
		adapter: lolStore,
	},
	{
		id: "lol-payments",
		label: "RP の購入",
		game: "lol",
		pattern: /^leagueoflegends\/rp_purchase_history_uc\.json$/,
		adapter: lolPayments,
	},
	{
		id: "lol-chat",
		label: "チャットログ",
		game: "lol",
		pattern: /^leagueoflegends\/chat_logs_v2_uc\/successes\/[^/]+\.json$/,
		adapter: chatLog("lol"),
	},
	{
		id: "lol-reports",
		label: "通報件数",
		game: "lol",
		pattern: /^leagueoflegends\/grouped_reports\.json$/,
		adapter: groupedReports("lol"),
	},
	{
		id: "tft-chat",
		label: "チャットログ",
		game: "tft",
		pattern: /^teamfighttactics\/tft_chat_logs_v2_uc\/successes\/[^/]+\.json$/,
		adapter: chatLog("tft"),
	},
	{
		id: "tft-reports",
		label: "通報件数",
		game: "tft",
		pattern: /^teamfighttactics\/tft_grouped_reports\.json$/,
		adapter: groupedReports("tft"),
	},
	{
		id: "valorant-matches",
		label: "試合履歴",
		game: "valorant",
		pattern: /^valorant\/valorant_match_history_uc\.json$/,
		adapter: valorantMatches,
	},
	{
		id: "valorant-payments",
		label: "VP の購入",
		game: "valorant",
		pattern: /^valorant\/valorant_payment_event_uc\.json$/,
		adapter: valorantPayments,
	},
	{
		id: "valorant-purchases",
		label: "ゲーム内での購入",
		game: "valorant",
		pattern: /^valorant\/valorant_purchase_event_uc\.json$/,
		adapter: valorantPurchases,
	},
	{
		id: "valorant-reports",
		label: "通報件数",
		game: "valorant",
		pattern: /^valorant\/valorant_grouped_reports\.json$/,
		adapter: groupedReports("valorant"),
	},
	{
		id: "lor-matches",
		label: "試合履歴",
		game: "lor",
		pattern: /^legendsofruneterra\/lor_match_history_uc\.json$/,
		adapter: lorMatches,
	},
	{
		id: "lor-payments",
		label: "コインの購入",
		game: "lor",
		pattern: /^legendsofruneterra\/lor_payment_history_event_uc\.json$/,
		adapter: lorPayments,
	},
	{
		id: "lor-purchases",
		label: "ゲーム内での購入",
		game: "lor",
		pattern: /^legendsofruneterra\/lor_purchase_history_event_uc\.json$/,
		adapter: lorPurchases,
	},
	{
		id: "wildrift-matches",
		label: "試合履歴",
		game: "wildrift",
		pattern: /^wildrift\/wildrift_match_history_uc\.json$/,
		adapter: wildriftMatches,
	},
	{
		id: "wildrift-currency",
		label: "通貨の残高",
		game: "wildrift",
		pattern: /^wildrift\/wildrift_currency\.json$/,
		adapter: wildriftCurrency,
	},
	{
		id: "wildrift-inventory",
		label: "所持品",
		game: "wildrift",
		pattern: /^wildrift\/wildrift_inventory\.json$/,
		adapter: wildriftInventory,
	},
	{
		id: "wildrift-purchases",
		label: "ゲーム内での購入",
		game: "wildrift",
		pattern: /^wildrift\/wildrift_purchase_event_uc\.json$/,
		adapter: wildriftPurchases,
	},
];

export function findFileKind(path: string): FileKind | null {
	return FILE_KINDS.find((kind) => kind.pattern.test(path)) ?? null;
}

const ROOT_GAMES: Readonly<Record<string, GameId>> = {
	"2xko": "2xko",
	league: "lol",
	leagueoflegends: "lol",
	legendsofruneterra: "lor",
	teamfighttactics: "tft",
	valorant: "valorant",
	wildrift: "wildrift",
};

/** 未対応のファイルが、どのゲームのフォルダにあるかを返す。 */
export function gameOfPath(path: string): GameId | null {
	const root = path.split("/")[0] ?? "";
	return ROOT_GAMES[root] ?? null;
}
