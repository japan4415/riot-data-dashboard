import type { ReactNode } from "react";
import styles from "./InlineFacts.module.css";

export interface InlineFact {
	label: string;
	value: ReactNode;
}

/**
 * 名前と値の組を横に並べる。通貨ごとの合計のように、足し合わせられない値を
 * 並べて見せるのに使う。
 */
export function InlineFacts({ items }: { items: readonly InlineFact[] }) {
	return (
		<dl className={styles.facts}>
			{items.map((item) => (
				<div key={item.label} className={styles.fact}>
					<dt>{item.label}</dt>
					<dd>{item.value}</dd>
				</div>
			))}
		</dl>
	);
}
