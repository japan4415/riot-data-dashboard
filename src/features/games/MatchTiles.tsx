import type { ReactNode } from "react";
import type { MatchSummary } from "../../analysis/matches.ts";
import { StatRow, StatTile } from "../../components/StatTile.tsx";
import {
	durationQuantity,
	formatNumber,
	formatPercent,
	minutesQuantity,
} from "../../labels/format.ts";

interface MatchTilesProps {
	summary: MatchSummary;
	/** ゲーム固有の数値。共通の数値の後ろに並べる。 */
	children?: ReactNode;
}

/** 試合履歴があるゲームに共通の、主要な数値。 */
export function MatchTiles({ summary, children }: MatchTilesProps) {
	return (
		<StatRow>
			<StatTile
				label="試合数"
				value={formatNumber(summary.matches)}
				unit="試合"
				note={
					summary.practice > 0
						? `ほかに練習 ${formatNumber(summary.practice)} 回`
						: undefined
				}
			/>
			<StatTile
				label="勝率"
				value={summary.winRate === null ? "—" : formatPercent(summary.winRate)}
				note={
					summary.winRate === null
						? "勝敗の付いた試合がありません"
						: `${formatNumber(summary.wins)} 勝 ${formatNumber(summary.losses)} 敗`
				}
			/>
			<StatTile
				label="プレイ時間"
				{...durationQuantity(summary.playSeconds)}
				note={summary.practice > 0 ? "練習を含む" : undefined}
			/>
			{summary.medianSeconds !== null && (
				<StatTile
					label="1 試合の長さ"
					{...minutesQuantity(summary.medianSeconds)}
					note="練習を除いた中央値"
				/>
			)}
			{children}
		</StatRow>
	);
}
