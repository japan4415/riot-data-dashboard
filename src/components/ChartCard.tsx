import { type ReactNode, useId, useState } from "react";
import styles from "./ChartCard.module.css";

type View = "chart" | "table";

interface ChartCardProps {
	title: string;
	/** 図表が何を数えているかの説明。 */
	description?: ReactNode;
	/** 系列の凡例や、濃淡の目盛り。図の表示のときだけ出す。 */
	legend?: ReactNode;
	chart: ReactNode;
	/** 図と同じ内容の表。色に頼らずに値を確かめられるようにする。 */
	table: ReactNode;
	/** 右上に置く補助的な操作やリンク。 */
	action?: ReactNode;
}

/** 図表の枠。見出し、説明、図と表の切り替えを持つ。 */
export function ChartCard({
	title,
	description,
	legend,
	chart,
	table,
	action,
}: ChartCardProps) {
	const [view, setView] = useState<View>("chart");
	const headingId = useId();

	return (
		<section className={styles.card} aria-labelledby={headingId}>
			<header className={styles.header}>
				<div className={styles.heading}>
					<h2 id={headingId} className={styles.title}>
						{title}
					</h2>
					{description && <p className={styles.description}>{description}</p>}
				</div>
				<div className={styles.controls}>
					{action}
					{/* biome-ignore lint/a11y/useSemanticElements: 2 つのボタンをまとめるだけで、入力欄の集まりではない */}
					<div
						className={styles.toggle}
						role="group"
						aria-label="表示の切り替え"
					>
						<button
							type="button"
							className={styles.toggleButton}
							aria-pressed={view === "chart"}
							onClick={() => setView("chart")}
						>
							図
						</button>
						<button
							type="button"
							className={styles.toggleButton}
							aria-pressed={view === "table"}
							onClick={() => setView("table")}
						>
							表
						</button>
					</div>
				</div>
			</header>

			{view === "chart" ? (
				<>
					{legend && <div className={styles.legend}>{legend}</div>}
					<div className={styles.body}>{chart}</div>
				</>
			) : (
				<div className={styles.tableScroll}>{table}</div>
			)}
		</section>
	);
}
