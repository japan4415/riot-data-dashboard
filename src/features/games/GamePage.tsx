import type { ReactNode } from "react";
import { periodLabel } from "../../analysis/period.ts";
import { useDashboard } from "../../app/DashboardContext.tsx";
import { EmptyState } from "../../components/EmptyState.tsx";
import { PageHeading } from "../../components/PageHeading.tsx";
import pageStyles from "../Page.module.css";

interface GamePageProps {
	title: string;
	/** 画面の説明。何が載っていて、何が開示データに無いかを書く。 */
	lead: ReactNode;
	/** 選んだ期間に、表示できる記録が無いか。 */
	empty: boolean;
	children: ReactNode;
}

/** ゲームの画面に共通の枠。期間内に記録が無いときは、その旨だけを示す。 */
export function GamePage({ title, lead, empty, children }: GamePageProps) {
	const { period } = useDashboard();
	return (
		<div className={pageStyles.page}>
			<PageHeading title={title}>
				{lead}
				{period.kind === "year" &&
					`${periodLabel(period)}の分を表示しています。`}
			</PageHeading>
			{empty ? (
				<EmptyState>
					{periodLabel(period)}に、{title} の記録はありません。
				</EmptyState>
			) : (
				children
			)}
		</div>
	);
}
