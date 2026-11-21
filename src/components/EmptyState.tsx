import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

/** 表示できる記録が無いことを伝える枠。 */
export function EmptyState({ children }: { children: ReactNode }) {
	return <p className={styles.empty}>{children}</p>;
}
