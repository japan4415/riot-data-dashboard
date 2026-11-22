import type { WinLoss } from "../../analysis/matches.ts";
import { formatNumber, formatPercent } from "../../labels/format.ts";

/** 横棒の横に添える勝敗の文言。勝率を先に、強く見せる。 */
export function WinLossText({ record }: { record: WinLoss }) {
	if (record.winRate === null) {
		return <>—</>;
	}
	return (
		<>
			<strong>{formatPercent(record.winRate)}</strong>{" "}
			{formatNumber(record.wins)} 勝 {formatNumber(record.losses)} 敗
		</>
	);
}
