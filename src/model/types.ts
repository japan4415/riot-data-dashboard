/**
 * 正規化したデータの型。
 *
 * zip の表記ゆれは読み込み時（`src/import`）に吸収する。
 * 集計と画面は、ここで定義した形だけを扱う。
 */

/** UTC のエポックミリ秒。 */
export type EpochMs = number;

export type GameId = "lol" | "tft" | "valorant" | "lor" | "wildrift" | "2xko";

/** 通貨名と量の組。増減を表すときは、支払いを負、獲得を正とする。 */
export interface CurrencyAmount {
	currency: string;
	amount: number;
}

// ---------------------------------------------------------------------------
// アカウント
// ---------------------------------------------------------------------------

export interface RiotId {
	gameName: string;
	tagLine: string;
}

export interface AccountProfile {
	riotId: RiotId | null;
	username: string | null;
	email: string | null;
	/** `YYYY-MM-DD` のまま保持する。 */
	dateOfBirth: string | null;
	/** 開示データの時点で一部が伏せ字になっている。 */
	phoneNumber: string | null;
	lolPlatform: string | null;
}

export type AccountEventSource = "v1" | "v2";

export interface AccountEvent {
	at: EpochMs;
	/** 出来事の種類。元の値のまま。 */
	type: string;
	description: string | null;
	source: AccountEventSource;
}

// ---------------------------------------------------------------------------
// ログイン記録
// ---------------------------------------------------------------------------

/** ログイン記録の対象。PC 版の LoL と TFT は元データで区別できない。 */
export type LoginTarget =
	| "lol-tft-pc"
	| "tft-mobile"
	| "valorant"
	| "wildrift"
	| "lor"
	| "riot-account"
	| "other";

export type LoginKind = "login" | "logout" | "auth" | "disconnect" | "other";

export interface LoginEvent {
	at: EpochMs;
	target: LoginTarget;
	rawProduct: string | null;
	kind: LoginKind;
	rawType: string;
	/** 記録が無い場合と `Unknown` の場合は null。 */
	ip: string | null;
}

// ---------------------------------------------------------------------------
// 試合
// ---------------------------------------------------------------------------

/** 表示用に寄せた試合の区分。 */
export type QueueCategory =
	| "ranked"
	| "normal"
	| "other"
	| "custom"
	| "practice";

/** `none` は勝敗が付かない試合（練習、チュートリアルなど）。 */
export type Outcome = "win" | "loss" | "none";

export interface MatchQueue {
	category: QueueCategory;
	rawMode: string | null;
	rawType: string | null;
}

interface MatchBase {
	id: string;
	startedAt: EpochMs | null;
	endedAt: EpochMs | null;
	durationSec: number | null;
	queue: MatchQueue;
	outcome: Outcome;
	/** 勝率の計算に含めるか。練習や、勝敗の記録が当てにならない種別は false。 */
	countsForWinRate: boolean;
}

export interface ValorantMatch extends MatchBase {
	game: "valorant";
	realm: string | null;
}

export interface LorMatch extends MatchBase {
	game: "lor";
	deckId: string | null;
	/** デッキの地域。値が無いものは含めない。 */
	factions: string[];
	turnCount: number | null;
	outcomeReason: string | null;
	platform: string | null;
	orderOfPlay: number | null;
	realm: string | null;
}

export interface WildRiftMatch extends MatchBase {
	game: "wildrift";
	/** その時点のランク。例: `Gold III` */
	rank: string | null;
	accountLevel: number | null;
}

export type Match = ValorantMatch | LorMatch | WildRiftMatch;

// ---------------------------------------------------------------------------
// 支払いと取引
// ---------------------------------------------------------------------------

/** 現金での支払い。 */
export interface Payment {
	game: GameId;
	id: string | null;
	at: EpochMs;
	/** 通貨コード。例: `JPY` */
	currency: string;
	/** 金額を 100 倍した整数。1,000 円は 100000。 */
	amountX100: number;
	method: string | null;
	/** 支払いで付与されたゲーム内通貨。 */
	granted: CurrencyAmount | null;
	ip: string | null;
}

export type TransactionKind =
	| "purchase"
	| "topUp"
	| "giftSent"
	| "giftReceived"
	| "refund"
	| "reward"
	| "other";

export interface TransactionItem {
	name: string | null;
	/** 品目の ID。名前に変換できていないもの。例: `championsskin_1001` */
	rawId: string | null;
	category: string | null;
	quantity: number | null;
}

/** ゲーム内通貨の増減をともなう取引。 */
export interface Transaction {
	game: GameId;
	id: string | null;
	at: EpochMs;
	kind: TransactionKind;
	rawKind: string | null;
	source: string | null;
	item: TransactionItem;
	deltas: CurrencyAmount[];
	/** 取引後の残高。分かるものだけ。 */
	balances: CurrencyAmount[];
	refunded: boolean | null;
	ip: string | null;
}

// ---------------------------------------------------------------------------
// 所持品
// ---------------------------------------------------------------------------

export type InventoryCategory =
	| "champion"
	| "skin"
	| "emote"
	| "icon"
	| "iconBorder"
	| "banner"
	| "bauble"
	| "consumable";

export interface InventoryItem {
	game: GameId;
	category: InventoryCategory;
	name: string;
	/** スキンの場合は対象のチャンピオン名。 */
	detail: string | null;
	quantity: number | null;
}

/** 現時点の通貨残高。 */
export interface CurrencyBalance extends CurrencyAmount {
	game: GameId;
}

// ---------------------------------------------------------------------------
// ペナルティ、通報、チャット、問い合わせ
// ---------------------------------------------------------------------------

export interface Penalty {
	at: EpochMs | null;
	scope: string | null;
	restrictionType: string | null;
	reason: string | null;
	sentence: string | null;
	status: string | null;
	isManual: boolean | null;
}

export type ReportDirection = "made" | "received";

export interface ReportCount {
	game: GameId;
	direction: ReportDirection;
	category: string;
	count: number;
}

export type ChatPhase = "preGame" | "inGame" | "postGame";

export interface ChatMessage {
	phase: ChatPhase;
	at: EpochMs | null;
	sender: string | null;
	sentTo: string | null;
	text: string;
}

export interface ChatLog {
	game: "lol" | "tft";
	gameId: string;
	matchDate: EpochMs | null;
	/** 試合日が日付だけで、時刻を持たない場合に true。 */
	matchDateIsDateOnly: boolean;
	platform: string | null;
	messages: ChatMessage[];
}

export interface TicketComment {
	author: string | null;
	at: EpochMs | null;
	text: string;
}

export interface SupportTicket {
	id: string;
	subject: string | null;
	status: string | null;
	createdAt: EpochMs | null;
	comments: TicketComment[];
}

// ---------------------------------------------------------------------------
// 全体
// ---------------------------------------------------------------------------

/** 配列で持つデータの種類。 */
export interface DatasetCollections {
	logins: LoginEvent[];
	matches: Match[];
	payments: Payment[];
	transactions: Transaction[];
	inventory: InventoryItem[];
	balances: CurrencyBalance[];
	accountEvents: AccountEvent[];
	penalties: Penalty[];
	reports: ReportCount[];
	chatLogs: ChatLog[];
	tickets: SupportTicket[];
}

export interface Dataset extends DatasetCollections {
	account: AccountProfile;
}

export function emptyAccountProfile(): AccountProfile {
	return {
		riotId: null,
		username: null,
		email: null,
		dateOfBirth: null,
		phoneNumber: null,
		lolPlatform: null,
	};
}

export function emptyDataset(): Dataset {
	return {
		account: emptyAccountProfile(),
		logins: [],
		matches: [],
		payments: [],
		transactions: [],
		inventory: [],
		balances: [],
		accountEvents: [],
		penalties: [],
		reports: [],
		chatLogs: [],
		tickets: [],
	};
}
