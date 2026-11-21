import type { ReactNode } from "react";
import styles from "./StatTile.module.css";

interface StatTileProps {
	label: string;
	value: ReactNode;
	/** 値の補足。単位や、何を数えたかの注記。 */
	note?: ReactNode;
}

/** 主要な数値 1 つを見せる枠。`dl` の中に並べて使う。 */
export function StatTile({ label, value, note }: StatTileProps) {
	return (
		<div className={styles.tile}>
			<dt className={styles.label}>{label}</dt>
			<dd className={styles.value}>{value}</dd>
			{note && <dd className={styles.note}>{note}</dd>}
		</div>
	);
}

/** 数値の枠を横に並べる。 */
export function StatRow({ children }: { children: ReactNode }) {
	return <dl className={styles.row}>{children}</dl>;
}
