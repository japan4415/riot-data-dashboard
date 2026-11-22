import type { IpSource } from "../analysis/account.ts";
import type { ChatPhase, ReportDirection } from "../model/types.ts";

/**
 * 元データの値（`PASSWORD_CHANGED` のような定数名）に添える、日本語の言い換え。
 *
 * 名前を訳したもので、Riot による定義ではない。対応が分からない値は、元の値のまま表示する。
 * 元データの文字列で引くので、オブジェクトではなく Map にする。
 */
type Glossary = ReadonlyMap<string, string>;

const ACCOUNT_EVENT_TYPES: Glossary = new Map([
	["ACCOUNT_STATE_CHANGED", "アカウントの状態の変更"],
	["PASSWORD_CHANGED", "パスワードの変更"],
	["EMAIL_VALIDATION_REQUESTED", "メールアドレスの確認の要求"],
	["SEND_VALIDATION_EMAIL", "確認メールの送信"],
	["EXCESSIVE_CHAT_TOXICITY", "チャットでの暴言の検知"],
	["EMAIL", "メールの送信"],
	["USER_FIELD_CHANGED", "登録情報の変更"],
	["FEDERATED_IDENTITY_CREATED", "外部アカウントとの連携の作成"],
	["LINKED_IDENTITY_CREATED", "アカウントの連携の作成"],
	["IDENTITY_LINK_SUCCESS", "アカウントの連携の成功"],
	["ANOMALOUS_ACTIVITY", "通常と異なる操作の検知"],
]);

/** ペナルティの対象。ゲームの名前なので、元の値は添えない。 */
const PENALTY_SCOPES: Glossary = new Map([
	["LEAGUE_OF_LEGENDS", "League of Legends"],
	["TEAMFIGHT_TACTICS", "Teamfight Tactics"],
	["VALORANT", "VALORANT"],
	["LEGENDS_OF_RUNETERRA", "Legends of Runeterra"],
	["WILD_RIFT", "Wild Rift"],
]);

const PENALTY_VALUES: Glossary = new Map([
	["CHAT_RESTRICTION", "チャットの制限"],
	["SUSPENSION", "利用の停止"],
	["DISRUPTIVE_COMMUNICATION", "迷惑なコミュニケーション"],
	["TIMEOUT", "期間つき"],
	["LAPSED", "期間が終了"],
]);

const REPORT_CATEGORIES: Glossary = new Map([
	["ASSISTING_ENEMY_TEAM", "敵チームへの加担"],
	["LEAVING_AFK", "放置や途中での離脱"],
	["RANK_MANIPULATION", "ランクの不正な操作"],
]);

const TICKET_STATUSES: Glossary = new Map([
	["open", "対応中"],
	["closed", "完了"],
	["deleted", "削除済み"],
]);

const TICKET_AUTHORS: Glossary = new Map([
	["Player", "自分"],
	["Agent", "サポート担当"],
]);

/** 言い換えと元の値を 1 つの文字列にする。例: `パスワードの変更（PASSWORD_CHANGED）` */
function glossed(glossary: Glossary, raw: string | null): string {
	if (raw === null) {
		return "—";
	}
	const label = glossary.get(raw);
	return label === undefined || label === raw ? raw : `${label}（${raw}）`;
}

export const accountEventLabel = (raw: string | null) =>
	glossed(ACCOUNT_EVENT_TYPES, raw);
export const penaltyLabel = (raw: string | null) =>
	glossed(PENALTY_VALUES, raw);

/** ペナルティの対象のゲーム名。対応が分からない値は、元の値のまま返す。 */
export function penaltyScopeLabel(raw: string | null): string {
	return raw === null ? "—" : (PENALTY_SCOPES.get(raw) ?? raw);
}
export const reportCategoryLabel = (raw: string | null) =>
	glossed(REPORT_CATEGORIES, raw);
export const ticketStatusLabel = (raw: string | null) =>
	glossed(TICKET_STATUSES, raw);
export const ticketAuthorLabel = (raw: string | null) =>
	glossed(TICKET_AUTHORS, raw);

export const REPORT_DIRECTION_LABELS: Readonly<
	Record<ReportDirection, string>
> = {
	made: "自分が通報した",
	received: "自分が通報された",
};

export const CHAT_PHASE_LABELS: Readonly<Record<ChatPhase, string>> = {
	preGame: "試合前",
	inGame: "試合中",
	postGame: "試合後",
};

/** チャットの宛先。`PARTY_<数値>` はパーティーあての発言。 */
export function chatTargetLabel(raw: string | null): string {
	if (raw === null) {
		return "—";
	}
	if (raw === "TEAM") {
		return "チーム";
	}
	return /^PARTY_\d+$/.test(raw) ? "パーティー" : raw;
}

export const IP_SOURCE_LABELS: Readonly<Record<IpSource, string>> = {
	login: "ログイン",
	payment: "支払い",
	store: "LoL のストア",
};
