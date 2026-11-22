import { type ReactNode, useState } from "react";
import { useMaskMode } from "./MaskContext.tsx";
import styles from "./Sensitive.module.css";

/** 伏せた値の代わりに出す記号。元の値の長さが分からないよう、長さは固定にする。 */
function Hidden() {
	return (
		<span className={styles.hidden}>
			<span aria-hidden="true">••••••</span>
			<span className={styles.srOnly}>伏せ字にしています</span>
		</span>
	);
}

interface SecretValueProps {
	/** 何の値か。表示の操作の名前に使う。例: `メールアドレス` */
	label: string;
	value: string;
}

/**
 * 初期状態で伏せておく値。押すと表示する。
 *
 * 伏せている間は、値そのものを画面の中に置かない。伏せ字モードでは、表示の操作も出さない。
 */
export function SecretValue({ label, value }: SecretValueProps) {
	const masked = useMaskMode();
	const [revealed, setRevealed] = useState(false);
	// 伏せ字モードを入れたら、表示していた値も伏せ直す。モードを切っても、勝手には表示しない
	if (masked && revealed) {
		setRevealed(false);
	}
	const shown = revealed && !masked;

	return (
		<span className={styles.secret}>
			{shown ? <span className={styles.value}>{value}</span> : <Hidden />}
			{!masked && (
				<button
					type="button"
					className={styles.reveal}
					aria-label={shown ? `${label}を隠す` : `${label}を表示`}
					onClick={() => setRevealed(!shown)}
				>
					{shown ? "隠す" : "表示"}
				</button>
			)}
		</span>
	);
}

/** ふだんは表示し、伏せ字モードのときだけ伏せる短い値。Riot ID など。 */
export function MaskedText({ children }: { children: ReactNode }) {
	return useMaskMode() ? <Hidden /> : children;
}

/** ふだんは表示し、伏せ字モードのときだけ伏せる本文。チャットや問い合わせの文面など。 */
export function MaskedBody({ children }: { children: string }) {
	if (useMaskMode()) {
		return <p className={styles.bodyHidden}>伏せ字にしています。</p>;
	}
	// 改行をそのまま見せる。文字列として表示するので、HTML としては解釈されない
	return <p className={styles.body}>{children}</p>;
}
