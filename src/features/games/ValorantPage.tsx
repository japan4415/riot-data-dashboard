import { useMemo } from "react";
import { matchesOf, matchSummary } from "../../analysis/matches.ts";
import { transactionsInPeriod, transactionsOf } from "../../analysis/store.ts";
import { useDashboard } from "../../app/DashboardContext.tsx";
import { GamePage } from "./GamePage.tsx";
import { MatchTiles } from "./MatchTiles.tsx";
import { MatchTrendCard } from "./MatchTrendCard.tsx";
import { PurchaseListCard } from "./PurchaseListCard.tsx";
import { QueueRecordCard } from "./QueueRecordCard.tsx";

/** VALORANT の画面。試合履歴と、ゲーム内通貨での購入を示す。 */
export function ValorantPage() {
	const { dataset, period, toLocal } = useDashboard();

	const matches = useMemo(
		() => matchesOf(dataset, "valorant", period, toLocal),
		[dataset, period, toLocal],
	);
	const summary = useMemo(() => matchSummary(matches), [matches]);
	const transactions = useMemo(
		() =>
			transactionsInPeriod(
				transactionsOf(dataset, "valorant"),
				period,
				toLocal,
			),
		[dataset, period, toLocal],
	);

	return (
		<GamePage
			title="VALORANT"
			lead="試合履歴と、ゲーム内通貨での購入の記録です。エージェント、マップ、スコアなどの試合の内容は、Riot の開示データに含まれません。"
			empty={matches.length === 0 && transactions.length === 0}
		>
			{matches.length > 0 && (
				<>
					<MatchTiles summary={summary} />
					<MatchTrendCard matches={matches} />
					<QueueRecordCard
						matches={matches}
						description="棒の長さは試合数、色の割合は勝ち負けを表します。Deathmatch は、勝敗がほぼすべて負けとして記録されているので、勝率に数えていません。射撃場などの練習も数えていません。"
					/>
				</>
			)}
			<PurchaseListCard
				transactions={transactions}
				description="VALORANT Points などのゲーム内通貨で購入したものです。現金での支払いは含みません。"
			/>
		</GamePage>
	);
}
