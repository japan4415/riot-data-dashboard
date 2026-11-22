import { type ReactNode, useId, useState } from "react";
import { formatNumber } from "../labels/format.ts";
import { type Column, DataTable } from "./DataTable.tsx";
import styles from "./ListCard.module.css";

interface ListCardProps<Row> {
	title: string;
	/** 一覧が何を並べているかの説明。 */
	description?: ReactNode;
	/** 絞り込みなどの操作。見出しの右に置く。 */
	controls?: ReactNode;
	/** 一覧の上に置く要約。 */
	summary?: ReactNode;
	columns: ReadonlyArray<Column<Row>>;
	rows: readonly Row[];
	rowKey: (row: Row) => string | number;
	pageSize?: number;
	/** 行が無いときに出す文言。 */
	empty?: string;
}

/**
 * 一覧の枠。行が多いときは、ページに分けて表示する。
 *
 * 絞り込みや期間の変更で行が入れ替わったら、先頭のページに戻す。
 */
export function ListCard<Row>({
	title,
	description,
	controls,
	summary,
	columns,
	rows,
	rowKey,
	pageSize = 25,
	empty,
}: ListCardProps<Row>) {
	const headingId = useId();
	const [state, setState] = useState({ rows, page: 0 });
	if (state.rows !== rows) {
		setState({ rows, page: 0 });
	}

	const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
	const page = state.rows === rows ? Math.min(state.page, pageCount - 1) : 0;
	const start = page * pageSize;
	const visible = rows.slice(start, start + pageSize);
	const setPage = (next: number) => setState({ rows, page: next });

	return (
		<section className={styles.card} aria-labelledby={headingId}>
			<header className={styles.header}>
				<div className={styles.heading}>
					<h2 id={headingId} className={styles.title}>
						{title}
					</h2>
					{description && <p className={styles.description}>{description}</p>}
				</div>
				{controls && <div className={styles.controls}>{controls}</div>}
			</header>

			{summary}

			<div className={styles.tableScroll}>
				<DataTable
					caption={title}
					columns={columns}
					rows={visible}
					rowKey={rowKey}
					empty={empty}
				/>
			</div>

			<div className={styles.footer}>
				<p className={styles.range} aria-live="polite">
					{rows.length > pageSize
						? `${formatNumber(start + 1)}〜${formatNumber(start + visible.length)} 件目（全 ${formatNumber(rows.length)} 件）`
						: `全 ${formatNumber(rows.length)} 件`}
				</p>
				{pageCount > 1 && (
					<div className={styles.pager}>
						<button
							type="button"
							className={styles.pageButton}
							disabled={page === 0}
							onClick={() => setPage(page - 1)}
						>
							前のページ
						</button>
						<button
							type="button"
							className={styles.pageButton}
							disabled={page >= pageCount - 1}
							onClick={() => setPage(page + 1)}
						>
							次のページ
						</button>
					</div>
				)}
			</div>
		</section>
	);
}
