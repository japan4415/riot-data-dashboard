import type { ReactNode } from "react";
import styles from "./BarList.module.css";
import type { LegendItem } from "./Legend.tsx";

export interface BarListRow {
	key: string;
	/** 行の名前。 */
	label: ReactNode;
	/** 名前の下に小さく添える補足。 */
	note?: ReactNode;
	/** 系列ごとの値。`series` と同じ順に並べる。 */
	values: readonly number[];
	/** 棒の横に文字で示す値。棒の長さだけに頼らずに読めるようにする。 */
	value: ReactNode;
}

interface BarListProps {
	series: readonly LegendItem[];
	rows: readonly BarListRow[];
	/** 一覧全体の説明。読み上げに使う。 */
	label: string;
}

/**
 * 横棒の一覧。行ごとに、系列の値を左から決まった順に積む。
 *
 * 棒の長さは、行の合計がもっとも大きい行を基準にする。値は必ず文字でも示すので、
 * 棒そのものは読み上げの対象から外す。
 */
export function BarList({ series, rows, label }: BarListProps) {
	const max = Math.max(
		1,
		...rows.map((row) => row.values.reduce((sum, value) => sum + value, 0)),
	);

	return (
		<ul className={styles.list} aria-label={label}>
			{rows.map((row) => {
				const lastIndex = row.values.findLastIndex((value) => value > 0);
				return (
					<li key={row.key} className={styles.row}>
						<div className={styles.name}>
							<span className={styles.label}>{row.label}</span>
							{row.note && <span className={styles.note}>{row.note}</span>}
						</div>
						<div className={styles.track} aria-hidden="true">
							{row.values.map((value, index) => {
								const item = series[index];
								if (!item || value <= 0) {
									return null;
								}
								return (
									<span
										key={item.id}
										className={styles.segment}
										data-end={index === lastIndex || undefined}
										style={{
											flexGrow: value,
											backgroundColor: item.color,
										}}
									/>
								);
							})}
							{/* 残りの幅を埋めて、棒の長さを最大の行に対する割合にする */}
							<span
								className={styles.rest}
								style={{
									flexGrow:
										max - row.values.reduce((sum, value) => sum + value, 0),
								}}
							/>
						</div>
						<div className={styles.value}>{row.value}</div>
					</li>
				);
			})}
		</ul>
	);
}
