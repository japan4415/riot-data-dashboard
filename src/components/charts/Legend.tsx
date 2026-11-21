import { LEVEL_COLORS } from "../../labels/activity.ts";
import styles from "./Legend.module.css";

export interface LegendItem {
	id: string;
	label: string;
	color: string;
}

/** 系列の凡例。文字は系列の色に染めず、色は横の目印だけで示す。 */
export function SeriesLegend({ items }: { items: readonly LegendItem[] }) {
	return (
		<ul className={styles.series}>
			{items.map((item) => (
				<li key={item.id} className={styles.seriesItem}>
					<span
						className={styles.swatch}
						style={{ backgroundColor: item.color }}
					/>
					{item.label}
				</li>
			))}
		</ul>
	);
}

/** 濃淡の目盛り。色が濃いほど（ダークでは明るいほど）多いことを示す。 */
export function LevelLegend({ unit }: { unit: string }) {
	return (
		<div className={styles.levels}>
			<span className={styles.levelGroup}>
				<span
					className={styles.cell}
					style={{ backgroundColor: LEVEL_COLORS[0] }}
				/>
				記録なし
			</span>
			<span className={styles.levelGroup}>
				{unit}が少ない
				<span className={styles.scale}>
					{LEVEL_COLORS.slice(1).map((color) => (
						<span
							key={color}
							className={styles.cell}
							style={{ backgroundColor: color }}
						/>
					))}
				</span>
				多い
			</span>
		</div>
	);
}
