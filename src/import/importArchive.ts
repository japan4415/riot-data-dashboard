import type {
	AccountProfile,
	Dataset,
	DatasetCollections,
	GameId,
} from "../model/types.ts";
import { emptyDataset } from "../model/types.ts";
import type { Contribution } from "./adapter.ts";
import { openArchive } from "./archive.ts";
import { isRecord } from "./read.ts";
import { FILE_KINDS, findFileKind, gameOfPath } from "./registry.ts";

/**
 * - `loaded`: レコードを読めた
 * - `empty`: ファイルはあるが、記録が無い
 * - `failed`: ファイルを読めなかった
 * - `unsupported`: 中身はあるが、表示に対応していないファイル
 */
export type ReportStatus = "loaded" | "empty" | "failed" | "unsupported";

/** 読み込み結果の 1 行。対応しているファイルは種類ごとに、それ以外は 1 ファイルごとにまとめる。 */
export interface ReportEntry {
	id: string;
	label: string;
	game: GameId | null;
	status: ReportStatus;
	/** zip に入っていたままのパス。 */
	paths: string[];
	records: number;
	/** 読めずに飛ばしたレコードの数。 */
	skipped: number;
	/** JSON として読めなかった、または変換に失敗したファイルの数。 */
	failedFiles: number;
}

export interface ImportTotals {
	files: number;
	records: number;
	skipped: number;
	failedFiles: number;
	unsupportedFiles: number;
}

export interface ImportReport {
	entries: ReportEntry[];
	totals: ImportTotals;
}

export interface ImportResult {
	dataset: Dataset;
	report: ImportReport;
}

const COLLECTION_KEYS = [
	"logins",
	"matches",
	"payments",
	"transactions",
	"inventory",
	"balances",
	"accountEvents",
	"penalties",
	"reports",
	"chatLogs",
	"tickets",
] as const satisfies ReadonlyArray<keyof DatasetCollections>;

const decoder = new TextDecoder("utf-8");

type ParseResult = { ok: true; json: unknown } | { ok: false };

function parseJson(bytes: Uint8Array): ParseResult {
	try {
		return { ok: true, json: JSON.parse(decoder.decode(bytes)) };
	} catch {
		return { ok: false };
	}
}

/** 空配列、空オブジェクト、または中身がそれらだけのオブジェクトなら true。 */
function isEmptyJson(json: unknown): boolean {
	if (json === null) {
		return true;
	}
	if (Array.isArray(json)) {
		return json.length === 0;
	}
	if (isRecord(json)) {
		return Object.values(json).every(isEmptyJson);
	}
	return false;
}

function hasAccountValue(
	account: Partial<AccountProfile> | undefined,
): boolean {
	return (
		account !== undefined &&
		Object.values(account).some(
			(value) => value !== null && value !== undefined,
		)
	);
}

function countRecords(contribution: Contribution): number {
	let count = hasAccountValue(contribution.account) ? 1 : 0;
	for (const key of COLLECTION_KEYS) {
		count += contribution[key]?.length ?? 0;
	}
	return count;
}

function appendAll<T>(target: T[], items: readonly T[] | undefined): void {
	if (!items) {
		return;
	}
	// 件数が多い配列を引数に展開すると呼び出しの上限を超えるので、1 件ずつ追加する
	for (const item of items) {
		target.push(item);
	}
}

function merge(dataset: Dataset, contribution: Contribution): void {
	appendAll(dataset.logins, contribution.logins);
	appendAll(dataset.matches, contribution.matches);
	appendAll(dataset.payments, contribution.payments);
	appendAll(dataset.transactions, contribution.transactions);
	appendAll(dataset.inventory, contribution.inventory);
	appendAll(dataset.balances, contribution.balances);
	appendAll(dataset.accountEvents, contribution.accountEvents);
	appendAll(dataset.penalties, contribution.penalties);
	appendAll(dataset.reports, contribution.reports);
	appendAll(dataset.chatLogs, contribution.chatLogs);
	appendAll(dataset.tickets, contribution.tickets);

	if (contribution.account) {
		const defined = Object.fromEntries(
			Object.entries(contribution.account).filter(
				([, value]) => value !== null && value !== undefined,
			),
		);
		Object.assign(dataset.account, defined);
	}
}

/** 時刻の昇順に並べる。時刻が無いものは末尾に置く。 */
function sortByTime<T>(items: T[], timeOf: (item: T) => number | null): void {
	items.sort((a, b) => {
		const left = timeOf(a);
		const right = timeOf(b);
		if (left === right) {
			return 0;
		}
		if (left === null) {
			return 1;
		}
		if (right === null) {
			return -1;
		}
		return left - right;
	});
}

function sortDataset(dataset: Dataset): void {
	sortByTime(dataset.logins, (item) => item.at);
	sortByTime(dataset.matches, (item) => item.startedAt ?? item.endedAt);
	sortByTime(dataset.payments, (item) => item.at);
	sortByTime(dataset.transactions, (item) => item.at);
	sortByTime(dataset.accountEvents, (item) => item.at);
	sortByTime(dataset.penalties, (item) => item.at);
	sortByTime(dataset.chatLogs, (item) => item.matchDate);
	sortByTime(dataset.tickets, (item) => item.createdAt);
}

function totalsOf(entries: readonly ReportEntry[]): ImportTotals {
	const totals: ImportTotals = {
		files: 0,
		records: 0,
		skipped: 0,
		failedFiles: 0,
		unsupportedFiles: 0,
	};
	for (const entry of entries) {
		totals.files += entry.paths.length;
		totals.records += entry.records;
		totals.skipped += entry.skipped;
		totals.failedFiles += entry.failedFiles;
		if (entry.status === "unsupported") {
			totals.unsupportedFiles += entry.paths.length;
		}
	}
	return totals;
}

/**
 * 開示データの zip を読み込み、正規化したデータと読み込み結果を返す。
 *
 * 1 件のレコードや 1 つのファイルが読めなくても、ほかの読み込みは続ける。
 * zip として読めない、または開示データではない場合だけ `ImportError` を投げる。
 */
export function importArchive(data: Uint8Array): ImportResult {
	const archive = openArchive(data);
	const dataset = emptyDataset();
	const known = new Map<string, ReportEntry>();
	const others: ReportEntry[] = [];

	for (const file of archive.files) {
		const kind = findFileKind(file.path);
		const parsed = parseJson(file.bytes);

		if (!kind) {
			others.push({
				id: file.path,
				label: file.path,
				game: gameOfPath(file.path),
				status: !parsed.ok
					? "failed"
					: isEmptyJson(parsed.json)
						? "empty"
						: "unsupported",
				paths: [file.originalPath],
				records: 0,
				skipped: 0,
				failedFiles: parsed.ok ? 0 : 1,
			});
			continue;
		}

		let entry = known.get(kind.id);
		if (!entry) {
			entry = {
				id: kind.id,
				label: kind.label,
				game: kind.game,
				status: "empty",
				paths: [],
				records: 0,
				skipped: 0,
				failedFiles: 0,
			};
			known.set(kind.id, entry);
		}
		entry.paths.push(file.originalPath);

		if (!parsed.ok) {
			entry.failedFiles += 1;
			continue;
		}

		let skipped = 0;
		try {
			const contribution = kind.adapter(parsed.json, {
				path: file.path,
				skip() {
					skipped += 1;
				},
			});
			entry.records += countRecords(contribution);
			entry.skipped += skipped;
			merge(dataset, contribution);
		} catch {
			// 変換関数は例外を出さない約束だが、出した場合もほかのファイルは読み続ける
			entry.failedFiles += 1;
		}
	}

	for (const entry of known.values()) {
		if (entry.records > 0) {
			entry.status = "loaded";
		} else if (entry.failedFiles === entry.paths.length) {
			entry.status = "failed";
		} else {
			entry.status = "empty";
		}
	}

	sortDataset(dataset);

	// 対応しているファイルは対応表の順に、それ以外はパスの順に並べる
	const entries = [
		...FILE_KINDS.flatMap((kind) => known.get(kind.id) ?? []),
		...others,
	];
	return { dataset, report: { entries, totals: totalsOf(entries) } };
}
