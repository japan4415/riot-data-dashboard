import { useId } from "react";
import { ALL_PERIOD } from "../analysis/period.ts";
import { useDashboard } from "./DashboardContext.tsx";
import styles from "./PeriodSelect.module.css";

/** 表示する期間の選択。すべての画面の図表と数値に同じ期間が適用される。 */
export function PeriodSelect() {
	const { years, period, setPeriod } = useDashboard();
	const id = useId();

	if (years.length === 0) {
		return null;
	}

	return (
		<div className={styles.period}>
			<label htmlFor={id} className={styles.label}>
				期間
			</label>
			<select
				id={id}
				className={styles.select}
				value={period.kind === "all" ? "all" : String(period.year)}
				onChange={(event) => {
					const value = event.target.value;
					setPeriod(
						value === "all"
							? ALL_PERIOD
							: { kind: "year", year: Number(value) },
					);
				}}
			>
				<option value="all">全期間</option>
				{[...years].reverse().map((year) => (
					<option key={year} value={year}>
						{year} 年
					</option>
				))}
			</select>
		</div>
	);
}
