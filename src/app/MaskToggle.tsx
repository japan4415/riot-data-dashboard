import { useDashboard } from "./DashboardContext.tsx";
import styles from "./MaskToggle.module.css";

/**
 * 伏せ字モードの切り替え。
 *
 * 入れると、Riot ID、チャットや問い合わせの本文なども伏せる。
 * 画面をそのままスクリーンショットに撮っても、個人の情報が写らないようにするためである。
 */
export function MaskToggle() {
	const { maskMode, setMaskMode } = useDashboard();
	return (
		<button
			type="button"
			className={styles.toggle}
			aria-pressed={maskMode}
			onClick={() => setMaskMode(!maskMode)}
		>
			<span className={styles.track} aria-hidden="true">
				<span className={styles.thumb} />
			</span>
			伏せ字
		</button>
	);
}
