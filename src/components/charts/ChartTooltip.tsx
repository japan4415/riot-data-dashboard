import type { ReactNode } from "react";
import styles from "./ChartTooltip.module.css";
import type { TooltipState } from "./useChartTooltip.ts";

interface ChartTooltipProps<T> {
	tip: TooltipState<T> | null;
	children: (data: T) => ReactNode;
}

/**
 * 図表の上に重ねる吹き出し。
 *
 * 吹き出しの中身は、表での表示でも確かめられる。読み上げには表を使ってもらうので、
 * ここは読み上げの対象から外す。
 */
export function ChartTooltip<T>({ tip, children }: ChartTooltipProps<T>) {
	if (!tip) {
		return null;
	}
	return (
		<div
			className={styles.tooltip}
			style={{ left: tip.x, top: tip.y }}
			aria-hidden="true"
		>
			{children(tip.data)}
		</div>
	);
}

interface TooltipRowProps {
	color?: string;
	label: string;
	value: string;
}

/** 吹き出しの 1 行。値を先に、強く見せる。 */
export function TooltipRow({ color, label, value }: TooltipRowProps) {
	return (
		<div className={styles.row}>
			{color && (
				<span className={styles.key} style={{ backgroundColor: color }} />
			)}
			<span className={styles.rowLabel}>{label}</span>
			<span className={styles.rowValue}>{value}</span>
		</div>
	);
}

export function TooltipTitle({ children }: { children: ReactNode }) {
	return <div className={styles.title}>{children}</div>;
}
