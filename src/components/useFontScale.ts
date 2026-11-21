import { useEffect, useState } from "react";

/**
 * 利用者の文字サイズ設定が、標準（16px）の何倍かを返す。
 *
 * 図表の中の文字は rem で大きさを決めている。見出しの列や目盛りの帯も同じ倍率で
 * 広げないと、文字を大きくしたときに重なってしまう。
 */
export function useFontScale(): number {
	const [scale, setScale] = useState(1);

	useEffect(() => {
		const size = Number.parseFloat(
			getComputedStyle(document.documentElement).fontSize,
		);
		if (Number.isFinite(size) && size > 0) {
			setScale(size / 16);
		}
	}, []);

	return scale;
}
