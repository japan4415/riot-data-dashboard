import type { ReactNode } from "react";
import styles from "./DataTable.module.css";

export interface Column<Row> {
	header: string;
	/** 数値の列は右にそろえ、桁をそろえる。 */
	numeric?: boolean;
	cell: (row: Row) => ReactNode;
}

interface DataTableProps<Row> {
	caption: string;
	columns: ReadonlyArray<Column<Row>>;
	rows: readonly Row[];
	rowKey: (row: Row) => string | number;
	/** 行が無いときに出す文言。 */
	empty?: string;
}

/** 図と同じ内容を確かめるための表。先頭の列を行の見出しにする。 */
export function DataTable<Row>({
	caption,
	columns,
	rows,
	rowKey,
	empty = "記録がありません。",
}: DataTableProps<Row>) {
	return (
		<table className={styles.table}>
			<caption className={styles.caption}>{caption}</caption>
			<thead>
				<tr>
					{columns.map((column) => (
						<th
							key={column.header}
							scope="col"
							className={column.numeric ? styles.numeric : undefined}
						>
							{column.header}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{rows.length === 0 && (
					<tr>
						<td colSpan={columns.length} className={styles.empty}>
							{empty}
						</td>
					</tr>
				)}
				{rows.map((row) => (
					<tr key={rowKey(row)}>
						{columns.map((column, index) =>
							index === 0 ? (
								<th key={column.header} scope="row">
									{column.cell(row)}
								</th>
							) : (
								<td
									key={column.header}
									className={column.numeric ? styles.numeric : undefined}
								>
									{column.cell(row)}
								</td>
							),
						)}
					</tr>
				))}
			</tbody>
		</table>
	);
}
