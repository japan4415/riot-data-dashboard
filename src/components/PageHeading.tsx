import { type ReactNode, useEffect, useRef } from "react";
import styles from "./PageHeading.module.css";

const APP_NAME = "Riot データダッシュボード";

interface PageHeadingProps {
	title: string;
	children?: ReactNode;
}

/**
 * 画面の見出し。
 *
 * 画面が切り替わったことを伝えるため、表示されたときに見出しへフォーカスを移し、
 * ページの題も合わせて変える。
 */
export function PageHeading({ title, children }: PageHeadingProps) {
	const headingRef = useRef<HTMLHeadingElement>(null);

	useEffect(() => {
		document.title = `${title} | ${APP_NAME}`;
		headingRef.current?.focus({ preventScroll: true });
		window.scrollTo(0, 0);
		return () => {
			document.title = APP_NAME;
		};
	}, [title]);

	return (
		<header className={styles.header}>
			<h1 ref={headingRef} tabIndex={-1} className={styles.heading}>
				{title}
			</h1>
			{children && <p className={styles.lead}>{children}</p>}
		</header>
	);
}
