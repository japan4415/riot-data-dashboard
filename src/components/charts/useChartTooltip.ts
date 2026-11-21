import { useCallback, useRef, useState } from "react";

export interface TooltipState<T> {
	/** 図表の枠の左上からの位置（px）。 */
	x: number;
	y: number;
	data: T;
}

/**
 * 図表の上に重ねる吹き出しの位置と中身を管理する。
 *
 * 位置は `containerRef` を付けた要素からの相対位置で持つ。吹き出しはこの要素の
 * 直下に置き、横にスクロールする領域の中には入れない（切り取られるのを防ぐため）。
 */
export function useChartTooltip<T>() {
	const containerRef = useRef<HTMLDivElement>(null);
	const [tip, setTip] = useState<TooltipState<T> | null>(null);

	const showAt = useCallback((clientX: number, clientY: number, data: T) => {
		const container = containerRef.current;
		if (!container) {
			return;
		}
		const rect = container.getBoundingClientRect();
		// 吹き出しが左右にはみ出さないよう、中心の位置を枠の内側に寄せる
		const margin = Math.min(110, rect.width / 2);
		const x = Math.min(
			Math.max(clientX - rect.left, margin),
			rect.width - margin,
		);
		setTip({ x, y: clientY - rect.top, data });
	}, []);

	/** 要素の上端の中央に吹き出しを出す。キーボードで選んだときに使う。 */
	const showAtElement = useCallback(
		(element: Element, data: T) => {
			const rect = element.getBoundingClientRect();
			showAt(rect.left + rect.width / 2, rect.top, data);
		},
		[showAt],
	);

	const hide = useCallback(() => setTip(null), []);

	return { containerRef, tip, showAt, showAtElement, hide };
}
