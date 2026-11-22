import { type ReactNode, useMemo, useState } from "react";
import {
	accountEvents,
	chatSummary,
	IP_SOURCES,
	type IpUsage,
	ipUsage,
	penalties,
	tickets,
} from "../../analysis/account.ts";
import { periodLabel } from "../../analysis/period.ts";
import { useDashboard } from "../../app/DashboardContext.tsx";
import { type Column, DataTable } from "../../components/DataTable.tsx";
import { InlineFacts } from "../../components/InlineFacts.tsx";
import { ListCard } from "../../components/ListCard.tsx";
import { useMaskMode } from "../../components/MaskContext.tsx";
import { PageHeading } from "../../components/PageHeading.tsx";
import { SectionCard } from "../../components/SectionCard.tsx";
import {
	MaskedBody,
	MaskedText,
	SecretValue,
} from "../../components/Sensitive.tsx";
import {
	accountEventLabel,
	CHAT_PHASE_LABELS,
	chatTargetLabel,
	IP_SOURCE_LABELS,
	penaltyLabel,
	penaltyScopeLabel,
	REPORT_DIRECTION_LABELS,
	reportCategoryLabel,
	ticketAuthorLabel,
	ticketStatusLabel,
} from "../../labels/account.ts";
import {
	formatDate,
	formatDateTime,
	formatNumber,
} from "../../labels/format.ts";
import { GAMES, gameLabel } from "../../labels/games.ts";
import type {
	AccountEvent,
	EpochMs,
	Penalty,
	ReportCount,
} from "../../model/types.ts";
import pageStyles from "../Page.module.css";
import styles from "./AccountPage.module.css";

/** 生年月日（`YYYY-MM-DD`）を、ほかの日付と同じ書き方にする。 */
function formatBirthday(value: string): string {
	const [year, month, day] = value.split("-").map(Number);
	return `${year}年${month}月${day}日`;
}

interface KnownOrMaskedProps {
	/** 元データの値。 */
	raw: string | null;
	/** 画面に出す文言。対応が分からない値では、元の値と同じになる。 */
	label: string;
}

/**
 * 対応が分かっている値は、言い換えた文言をそのまま出す。対応が分からない値は、
 * 元の値がそのまま出る（相手の Riot ID などが入りうる）ので、伏せ字モードで伏せる。
 */
function KnownOrMasked({ raw, label }: KnownOrMaskedProps) {
	return raw !== null && label === raw ? (
		<MaskedText>{label}</MaskedText>
	) : (
		label
	);
}

function time(at: EpochMs | null, format: (at: EpochMs) => string): string {
	return at === null ? "日時の記録なし" : format(at);
}

function ProfileCard() {
	const { dataset } = useDashboard();
	const { riotId, username, email, dateOfBirth, phoneNumber, lolPlatform } =
		dataset.account;

	const rows: Array<{ label: string; value: ReactNode }> = [];
	if (riotId) {
		rows.push({
			label: "Riot ID",
			value: (
				<MaskedText>
					{riotId.gameName}#{riotId.tagLine}
				</MaskedText>
			),
		});
	}
	if (username !== null) {
		rows.push({
			label: "ユーザー名",
			value: <MaskedText>{username}</MaskedText>,
		});
	}
	if (email !== null) {
		rows.push({
			label: "メールアドレス",
			value: <SecretValue label="メールアドレス" value={email} />,
		});
	}
	if (dateOfBirth !== null) {
		rows.push({
			label: "生年月日",
			value: (
				<SecretValue label="生年月日" value={formatBirthday(dateOfBirth)} />
			),
		});
	}
	if (phoneNumber !== null) {
		rows.push({
			label: "電話番号",
			value: <SecretValue label="電話番号" value={phoneNumber} />,
		});
	}
	if (lolPlatform !== null) {
		rows.push({ label: "LoL のプラットフォーム", value: lolPlatform });
	}

	return (
		<SectionCard
			title="登録情報"
			description="メールアドレス、生年月日、電話番号は、初めは伏せてあります。電話番号は、開示データの時点で一部が伏せられています。"
		>
			{rows.length === 0 ? (
				<p className={styles.empty}>登録情報の記録がありません。</p>
			) : (
				<dl className={styles.profile}>
					{rows.map((row) => (
						<div key={row.label} className={styles.profileRow}>
							<dt>{row.label}</dt>
							<dd>{row.value}</dd>
						</div>
					))}
				</dl>
			)}
		</SectionCard>
	);
}

/** 項目名や状態を表す短い語。英字で始まり、英数字、下線、空白だけからなる。 */
const PLAIN_WORD = /^[A-Za-z][A-Za-z0-9_ ]{0,39}$/;

/**
 * 変更履歴の補足。
 *
 * 手元の開示データでは `delivered` や `username` のような短い語だけが入っていた。
 * ただし自由な文字列を入れられる項目なので、短い語でない値（メールアドレスなどが
 * 入っている場合）は、伏せ字モードで伏せる。
 */
function EventNote({ description }: { description: string | null }) {
	if (description === null) {
		return "—";
	}
	return PLAIN_WORD.test(description) ? (
		description
	) : (
		<MaskedText>{description}</MaskedText>
	);
}

function EventCard() {
	const { dataset, period, toLocal } = useDashboard();
	const rows = useMemo(
		() => accountEvents(dataset, period, toLocal),
		[dataset, period, toLocal],
	);
	const keys = useMemo(
		() => new Map(rows.map((row, index) => [row, index])),
		[rows],
	);
	const columns = useMemo<Column<AccountEvent>[]>(
		() => [
			{ header: "日時", cell: (row) => formatDateTime(row.at, toLocal) },
			{ header: "出来事", cell: (row) => accountEventLabel(row.type) },
			{
				header: "補足",
				cell: (row) => <EventNote description={row.description} />,
			},
		],
		[toLocal],
	);

	return (
		<ListCard
			title="アカウントの変更履歴"
			description="パスワードの変更やメールの送信など、アカウントに起きた出来事です。出来事の名前は、元の値を訳したものに元の値を添えています。"
			columns={columns}
			rows={rows}
			rowKey={(row) => keys.get(row) ?? row.at}
			empty="この期間に、変更の記録はありません。"
		/>
	);
}

function PenaltyCard() {
	const { dataset, period, toLocal } = useDashboard();
	const rows = useMemo(
		() => penalties(dataset, period, toLocal),
		[dataset, period, toLocal],
	);

	// 項目が多く値も長いので、表にせず、1 件ごとに項目を並べる。たたまずに最初から見せる
	const facts = (penalty: Penalty) => [
		{ label: "対象", value: penaltyScopeLabel(penalty.scope) },
		{ label: "理由", value: penaltyLabel(penalty.reason) },
		{ label: "処分の形", value: penaltyLabel(penalty.sentence) },
		{ label: "状態", value: penaltyLabel(penalty.status) },
		{
			label: "発行の方法",
			value:
				penalty.isManual === null ? "—" : penalty.isManual ? "手動" : "自動",
		},
	];

	return (
		<SectionCard
			title="ペナルティ"
			description="チャットの制限や利用の停止の記録です。制限の期間や終了日時は、Riot の開示データに含まれません。"
		>
			{rows.length === 0 ? (
				<p className={styles.empty}>
					{dataset.penalties.length === 0
						? "ペナルティの記録はありません。"
						: "この期間に、ペナルティの記録はありません。"}
				</p>
			) : (
				<ul className={styles.threads}>
					{rows.map((penalty, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: ペナルティには ID が無く、並びも変わらない
						<li key={index} className={styles.thread}>
							<h3 className={styles.threadTitle}>
								{penaltyLabel(penalty.restrictionType)}
							</h3>
							<p className={styles.meta}>
								{time(penalty.at, (at) => formatDateTime(at, toLocal))} に発行
							</p>
							<dl className={styles.facts}>
								{facts(penalty).map((fact) => (
									<div key={fact.label}>
										<dt>{fact.label}</dt>
										<dd>{fact.value}</dd>
									</div>
								))}
							</dl>
						</li>
					))}
				</ul>
			)}
		</SectionCard>
	);
}

const REPORT_COLUMNS: Column<ReportCount>[] = [
	{ header: "ゲーム", cell: (row) => gameLabel(row.game) },
	{ header: "向き", cell: (row) => REPORT_DIRECTION_LABELS[row.direction] },
	{ header: "分類", cell: (row) => reportCategoryLabel(row.category) },
	{ header: "件数", numeric: true, cell: (row) => formatNumber(row.count) },
];

function ReportCard() {
	const { dataset } = useDashboard();
	const rows = useMemo(
		() =>
			[...dataset.reports].sort(
				(a, b) =>
					GAMES.indexOf(a.game) - GAMES.indexOf(b.game) ||
					a.direction.localeCompare(b.direction) ||
					b.count - a.count,
			),
		[dataset],
	);

	return (
		<SectionCard
			title="通報の件数"
			description="自分が通報した件数と、通報された件数です。開示データには合計だけが入っていて、日時が無いので、期間の絞り込みは適用されません。"
		>
			<div className={styles.tableFrame}>
				<DataTable
					caption="通報の件数"
					columns={REPORT_COLUMNS}
					rows={rows}
					rowKey={(row) => `${row.game}-${row.direction}-${row.category}`}
					empty="通報の記録はありません。"
				/>
			</div>
		</SectionCard>
	);
}

function TicketCard() {
	const { dataset, period, toLocal } = useDashboard();
	const rows = useMemo(
		() => tickets(dataset, period, toLocal),
		[dataset, period, toLocal],
	);

	return (
		<SectionCard
			title="問い合わせ"
			description="サポートへの問い合わせと、そのやりとりです。"
		>
			{rows.length === 0 ? (
				<p className={styles.empty}>
					{dataset.tickets.length === 0
						? "問い合わせの記録はありません。"
						: "この期間に、問い合わせの記録はありません。"}
				</p>
			) : (
				<ul className={styles.threads}>
					{rows.map((ticket) => (
						<li key={ticket.id} className={styles.thread}>
							<h3 className={styles.threadTitle}>
								<MaskedText>{ticket.subject ?? "件名なし"}</MaskedText>
							</h3>
							<p className={styles.meta}>
								{time(ticket.createdAt, (at) => formatDateTime(at, toLocal))}・
								{ticketStatusLabel(ticket.status)}
							</p>
							{ticket.comments.length === 0 ? (
								<p className={styles.empty}>やりとりの記録はありません。</p>
							) : (
								<ol className={styles.messages}>
									{ticket.comments.map((comment, index) => (
										// biome-ignore lint/suspicious/noArrayIndexKey: やりとりには ID が無く、並びも変わらない
										<li key={index} className={styles.message}>
											<p className={styles.meta}>
												<strong>
													<KnownOrMasked
														raw={comment.author}
														label={ticketAuthorLabel(comment.author)}
													/>
												</strong>
												・
												{time(comment.at, (at) => formatDateTime(at, toLocal))}
											</p>
											<MaskedBody>{comment.text}</MaskedBody>
										</li>
									))}
								</ol>
							)}
						</li>
					))}
				</ul>
			)}
		</SectionCard>
	);
}

function ChatCard() {
	const { dataset, period, toLocal } = useDashboard();
	const summary = useMemo(
		() => chatSummary(dataset, period, toLocal),
		[dataset, period, toLocal],
	);

	return (
		<SectionCard
			title="チャットログ"
			description="League of Legends と Teamfight Tactics の試合での、自分の発言です。開示データに入っているのは、直近の試合の分だけです。"
		>
			{summary.matches === 0 ? (
				<p className={styles.empty}>
					{dataset.chatLogs.length === 0
						? "チャットログの記録はありません。"
						: "この期間に、チャットログの記録はありません。"}
				</p>
			) : (
				<>
					<InlineFacts
						items={[
							{
								label: "ログがある試合",
								value: <strong>{formatNumber(summary.matches)} 試合</strong>,
							},
							{
								label: "発言が無い試合",
								value: (
									<strong>{formatNumber(summary.silentMatches)} 試合</strong>
								),
							},
							{
								label: "発言",
								value: <strong>{formatNumber(summary.messages)} 件</strong>,
							},
						]}
					/>
					{summary.logs.length > 0 && (
						<ul className={styles.threads}>
							{summary.logs.map((log) => (
								<li key={`${log.game}-${log.gameId}`} className={styles.thread}>
									<h3 className={styles.threadTitle}>
										{gameLabel(log.game)}・
										{time(log.matchDate, (at) =>
											log.matchDateIsDateOnly
												? formatDate(at, toLocal)
												: formatDateTime(at, toLocal),
										)}
									</h3>
									<ol className={styles.messages}>
										{log.messages.map((message, index) => (
											// biome-ignore lint/suspicious/noArrayIndexKey: 発言には ID が無く、並びも変わらない
											<li key={index} className={styles.message}>
												<p className={styles.meta}>
													<strong>
														<MaskedText>
															{message.sender ?? "発言者の記録なし"}
														</MaskedText>
													</strong>
													・{CHAT_PHASE_LABELS[message.phase]}・
													<KnownOrMasked
														raw={message.sentTo}
														label={chatTargetLabel(message.sentTo)}
													/>
													あて・
													{time(message.at, (at) =>
														formatDateTime(at, toLocal),
													)}
												</p>
												<MaskedBody>{message.text}</MaskedBody>
											</li>
										))}
									</ol>
								</li>
							))}
						</ul>
					)}
				</>
			)}
		</SectionCard>
	);
}

interface RankedIp extends IpUsage {
	/** 回数が多い順に付けた番号（1 始まり）。アドレスを伏せていても行を区別できるようにする。 */
	rank: number;
}

function IpCard() {
	const { dataset, period, toLocal } = useDashboard();
	const masked = useMaskMode();
	const [revealed, setRevealed] = useState(false);
	// 伏せ字モードを入れたら、表示していたアドレスも伏せ直す。モードを切っても、勝手には表示しない
	if (masked && revealed) {
		setRevealed(false);
	}
	const shown = revealed && !masked;

	const rows = useMemo<RankedIp[]>(
		() =>
			ipUsage(dataset, period, toLocal).map((usage, index) => ({
				...usage,
				rank: index + 1,
			})),
		[dataset, period, toLocal],
	);
	const columns = useMemo<Column<RankedIp>[]>(
		() => [
			{ header: "順位", cell: (row) => formatNumber(row.rank) },
			{
				header: "IP アドレス",
				cell: (row) =>
					shown ? (
						row.ip
					) : (
						<span className={styles.hiddenAddress}>
							<span aria-hidden="true">••••••</span>
							<span className={styles.srOnly}>伏せ字にしています</span>
						</span>
					),
			},
			{ header: "回数", numeric: true, cell: (row) => formatNumber(row.count) },
			...IP_SOURCES.map((source) => ({
				header: IP_SOURCE_LABELS[source],
				numeric: true,
				cell: (row: RankedIp) => formatNumber(row.sources[source]),
			})),
			{ header: "最初の記録", cell: (row) => formatDate(row.first, toLocal) },
			{ header: "最後の記録", cell: (row) => formatDate(row.last, toLocal) },
		],
		[shown, toLocal],
	);

	return (
		<ListCard
			title="IP アドレスの一覧"
			description="ログイン、現金での支払い、LoL のストアの取引に記録されていたアドレスを、回数が多い順に並べています。アドレスは初めは伏せてあります。アドレスから地域を推定することはしていません。"
			controls={
				rows.length > 0 && !masked ? (
					<button
						type="button"
						className={styles.reveal}
						onClick={() => setRevealed(!shown)}
					>
						{shown ? "アドレスを隠す" : "アドレスを表示"}
					</button>
				) : undefined
			}
			columns={columns}
			rows={rows}
			rowKey={(row) => row.rank}
			empty="この期間に、IP アドレスの記録はありません。"
		/>
	);
}

/** アカウントの画面。登録情報と、アカウントに起きたことの記録を示す。 */
export function AccountPage() {
	const { period } = useDashboard();
	return (
		<div className={pageStyles.page}>
			<PageHeading title="アカウント">
				登録情報、変更履歴、ペナルティ、問い合わせなどの記録です。上部の「伏せ字」を入れると、Riot
				ID や本文も伏せるので、画面をそのまま人に見せられます。
				{period.kind === "year" &&
					`日時のある記録は、${periodLabel(period)}の分を表示しています。`}
			</PageHeading>

			<ProfileCard />
			<EventCard />
			<PenaltyCard />
			<ReportCard />
			<TicketCard />
			<ChatCard />
			{/* 期間を変えたら、アドレスを伏せた状態に戻す。押していない行が表示されるのを防ぐ */}
			<IpCard key={period.kind === "all" ? "all" : period.year} />
		</div>
	);
}
