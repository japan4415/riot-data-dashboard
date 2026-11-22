import { PageHeading } from "../../components/PageHeading.tsx";
import { MaskedText } from "../../components/Sensitive.tsx";
import { StatRow, StatTile } from "../../components/StatTile.tsx";
import type {
	ImportResult,
	ReportEntry,
	ReportStatus,
} from "../../import/importArchive.ts";
import { FILE_KINDS } from "../../import/registry.ts";
import { GAME_ORDER, gameLabel } from "../../labels/games.ts";
import type { GameId } from "../../model/types.ts";
import pageStyles from "../Page.module.css";
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
}

/** 読み込み結果の画面。zip の中の何を読めて、何を読めなかったかを示す。 */
export function ImportReportPage({ result }: ImportReportPageProps) {
	const { entries, totals } = result.report;

	return (
		<div className={pageStyles.page}>
			<PageHeading title="読み込み結果">
				zip
				の中のファイルを、種類ごとにまとめています。期間の選択は、この画面には適用されません。
			</PageHeading>

			<StatRow>
				<StatTile label="ファイル" value={numberFormat.format(totals.files)} />
				<StatTile
					label="読み込んだ記録"
					value={numberFormat.format(totals.records)}
				/>
				<StatTile
					label="飛ばした記録"
					value={numberFormat.format(totals.skipped)}
				/>
				<StatTile
					label="読めなかったファイル"
					value={numberFormat.format(totals.failedFiles)}
				/>
			</StatRow>

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
													// 包んでいるフォルダの名前（Riot ID を含むことがある）が残りうるので、伏せ字モードでは伏せる
													<MaskedText>
														<code className={styles.path}>{entry.label}</code>
													</MaskedText>
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
		</div>
	);
}
