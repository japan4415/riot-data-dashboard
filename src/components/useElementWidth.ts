import { type RefObject, useEffect, useState } from "react";

/**
 * 要素の幅を返す。幅が変わると再描画する。
 *
 * 図表は実際の表示幅に合わせて描く（拡大縮小すると文字まで小さくなるため）。
 * 幅を測れない環境では `fallback` を返す。
 */
export function useElementWidth(
	ref: RefObject<HTMLElement | null>,
	fallback = 720,
): number {
	const [width, setWidth] = useState(fallback);

	useEffect(() => {
		const element = ref.current;
		if (!element || typeof ResizeObserver !== "function") {
			return;
		}
		const observer = new ResizeObserver((entries) => {
			const next = entries[0]?.contentRect.width;
			if (next !== undefined && next > 0) {
				setWidth(Math.floor(next));
			}
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref]);

	return width;
}
