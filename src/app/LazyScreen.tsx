import { type ComponentType, useEffect, useState } from "react";
import styles from "./LazyScreen.module.css";

export interface ScreenLoader {
	/** 画面のコードを読み込む。読み込み済みなら、同じ結果を返す。 */
	load: () => Promise<ComponentType>;
	/** 読み込み済みの画面。まだなら null。 */
	loaded: () => ComponentType | null;
}

/**
 * 画面のコードを、必要になったときに読み込むための入れ物を作る。
 *
 * 読み込みに失敗したときは結果を覚えず、次に呼ばれたらもう一度読み込みを試す。
 */
export function createScreenLoader(
	importer: () => Promise<ComponentType>,
): ScreenLoader {
	let pending: Promise<ComponentType> | null = null;
	let screen: ComponentType | null = null;
	return {
		load() {
			pending ??= importer().then(
				(component) => {
					screen = component;
					return component;
				},
				(error: unknown) => {
					pending = null;
					throw error;
				},
			);
			return pending;
		},
		loaded: () => screen,
	};
}

type State =
	| { kind: "loading" }
	| { kind: "ready"; Screen: ComponentType }
	| { kind: "failed" };

interface LazyScreenProps {
	loader: ScreenLoader;
}

/**
 * コードを後から読み込む画面。
 *
 * 読み込みに失敗しても、アプリケーション全体は止めない。読み込んだデータは
 * メモリの上にしか無いので、画面ごと落ちると利用者はデータを選び直すことになる。
 */
export function LazyScreen({ loader }: LazyScreenProps) {
	const [state, setState] = useState<State>(() => {
		const Screen = loader.loaded();
		return Screen ? { kind: "ready", Screen } : { kind: "loading" };
	});
	const [attempt, setAttempt] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: 「もう一度試す」を押すたびに読み込み直す
	useEffect(() => {
		// 先読みなどで、この画面が待っている間に読み込みが済んでいることがある
		const Screen = loader.loaded();
		if (Screen) {
			setState({ kind: "ready", Screen });
			return;
		}
		let cancelled = false;
		loader.load().then(
			(Screen) => {
				if (!cancelled) {
					setState({ kind: "ready", Screen });
				}
			},
			() => {
				if (!cancelled) {
					setState({ kind: "failed" });
				}
			},
		);
		return () => {
			cancelled = true;
		};
	}, [loader, attempt]);

	if (state.kind === "ready") {
		return <state.Screen />;
	}
	if (state.kind === "failed") {
		return (
			<div className={styles.message} role="alert">
				<p>
					この画面を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。ほかの画面は、そのまま使えます。
				</p>
				<button
					type="button"
					className={styles.retry}
					onClick={() => {
						setState({ kind: "loading" });
						setAttempt((count) => count + 1);
					}}
				>
					もう一度試す
				</button>
			</div>
		);
	}
	return (
		<p className={styles.message} role="status">
			画面を読み込んでいます。
		</p>
	);
}
