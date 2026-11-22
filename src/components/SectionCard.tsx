import { type ReactNode, useId } from "react";
import styles from "./SectionCard.module.css";

interface SectionCardProps {
	title: string;
	/** 何を載せているかの説明。 */
	description?: ReactNode;
	/** 絞り込みなどの操作。見出しの右に置く。 */
	controls?: ReactNode;
	children: ReactNode;
}

/** 見出しと説明を持つ枠。一覧や文面など、図表でない内容を載せる。 */
export function SectionCard({
	title,
	description,
	controls,
	children,
}: SectionCardProps) {
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
				{controls && <div className={styles.controls}>{controls}</div>}
			</header>
			{children}
		</section>
	);
}
