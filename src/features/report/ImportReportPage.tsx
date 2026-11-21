import { useEffect, useRef } from "react";
import type {
	ImportResult,
	ReportEntry,
	ReportStatus,
} from "../../import/importArchive.ts";
import { FILE_KINDS } from "../../import/registry.ts";
import { GAME_ORDER, gameLabel } from "../../labels/games.ts";
import type { GameId } from "../../model/types.ts";
import styles from "./ImportReportPage.module.css";

const STATUS_LABELS: Readonly<Record<ReportStatus, string>> = {
	loaded: "読み込み済み",
	empty: "記録なし",
	unsupported: "未対応",
	failed: "読み込み失敗",
};

const numberFormat = new Intl.NumberFormat("ja-JP");
const KNOWN_KIND_IDS = new Set(FILE_KINDS.map((kind) => kind.id));

interface Group {
	game: GameId | null;
	entries: ReportEntry[];
}

function groupByGame(entries: readonly ReportEntry[]): Group[] {
	return GAME_ORDER.map((game) => ({
		game,
		entries: entries.filter((entry) => entry.game === game),
	})).filter((group) => group.entries.length > 0);
}

interface ImportReportPageProps {
	result: ImportResult;
	onDiscard: () => void;
}

export function ImportReportPage({ result, onDiscard }: ImportReportPageProps) {
	const { entries, totals } = result.report;
	const headingRef = useRef<HTMLHeadingElement>(null);

	// 画面が切り替わったことを伝えるため、見出しへフォーカスを移す
	useEffect(() => {
		headingRef.current?.focus();
		window.scrollTo(0, 0);
	}, []);

	const summary = [
		{ label: "ファイル", value: totals.files },
		{ label: "読み込んだ記録", value: totals.records },
		{ label: "飛ばした記録", value: totals.skipped },
		{ label: "読めなかったファイル", value: totals.failedFiles },
	];

	return (
		<>
			<section className={styles.intro} aria-labelledby="report-heading">
				<h1
					id="report-heading"
					ref={headingRef}
					tabIndex={-1}
					className={styles.heading}
				>
					読み込み結果
				</h1>
				<p className={styles.lead}>
					zip
					を読み込みました。集計と図表の画面は準備中です。いまは、読み込めた内容の一覧だけを表示します。
				</p>

				<dl className={styles.summary}>
					{summary.map((item) => (
						<div key={item.label} className={styles.summaryItem}>
							<dt className={styles.summaryLabel}>{item.label}</dt>
							<dd className={styles.summaryValue}>
								{numberFormat.format(item.value)}
							</dd>
						</div>
					))}
				</dl>

				<button
					type="button"
					className={styles.discardButton}
					onClick={onDiscard}
				>
					データを破棄して最初に戻る
				</button>
			</section>

			{groupByGame(entries).map((group) => {
				const headingId = `report-group-${group.game ?? "account"}`;
				return (
					<section
						key={headingId}
						className={styles.group}
						aria-labelledby={headingId}
					>
						<h2 id={headingId} className={styles.groupHeading}>
							{gameLabel(group.game)}
						</h2>
						<div className={styles.tableScroll}>
							<table className={styles.table}>
								<thead>
									<tr>
										<th scope="col">種類</th>
										<th scope="col">状態</th>
										<th scope="col" className={styles.numeric}>
											件数
										</th>
										<th scope="col" className={styles.numeric}>
											飛ばした件数
										</th>
									</tr>
								</thead>
								<tbody>
									{group.entries.map((entry) => (
										<tr key={entry.id}>
											<th scope="row" className={styles.kind}>
												{KNOWN_KIND_IDS.has(entry.id) ? (
													entry.label
												) : (
													<code className={styles.path}>{entry.label}</code>
												)}
												{entry.paths.length > 1 && (
													<span className={styles.fileCount}>
														{numberFormat.format(entry.paths.length)} ファイル
													</span>
												)}
											</th>
											<td>
												<span
													className={styles.statusBadge}
													data-status={entry.status}
												>
													{STATUS_LABELS[entry.status]}
												</span>
											</td>
											<td className={styles.numeric}>
												{numberFormat.format(entry.records)}
											</td>
											<td className={styles.numeric}>
												{numberFormat.format(entry.skipped)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				);
			})}

			<section
				className={styles.legend}
				aria-labelledby="report-legend-heading"
			>
				<h2 id="report-legend-heading" className={styles.legendHeading}>
					状態の意味
				</h2>
				<dl className={styles.legendList}>
					<div>
						<dt>記録なし</dt>
						<dd>ファイルはありますが、中に記録がありません。</dd>
					</div>
					<div>
						<dt>未対応</dt>
						<dd>
							中身はありますが、このアプリケーションでの表示に未対応です。
						</dd>
					</div>
					<div>
						<dt>読み込み失敗</dt>
						<dd>ファイルが壊れているなどの理由で、読めませんでした。</dd>
					</div>
				</dl>
			</section>
		</>
	);
}
