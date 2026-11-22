import { type ReactNode, useMemo } from "react";
import { currencyFlows } from "../../analysis/store.ts";
import { useDashboard } from "../../app/DashboardContext.tsx";
import type { Column } from "../../components/DataTable.tsx";
import { InlineFacts } from "../../components/InlineFacts.tsx";
import { ListCard } from "../../components/ListCard.tsx";
import { formatDateTime, formatNumber } from "../../labels/format.ts";
import { formatSpent, itemName } from "../../labels/store.ts";
import type { Transaction } from "../../model/types.ts";

interface PurchaseListCardProps {
	/** 期間内の取引。古い順。 */
	transactions: readonly Transaction[];
	description: ReactNode;
}

/** ゲーム内通貨での購入の一覧。新しい順に並べる。 */
export function PurchaseListCard({
	transactions,
	description,
}: PurchaseListCardProps) {
	const { toLocal } = useDashboard();

	const { rows, keys, flows, columns } = useMemo(() => {
		const rows = [...transactions].reverse();
		// 取引 ID が無いゲームがあるので、並び順を行の識別に使う
		const keys = new Map(rows.map((row, index) => [row, index]));
		const flows = currencyFlows(transactions).filter((flow) => flow.spent > 0);

		// 値が 1 種類しか無い列は、見ても区別の役に立たないので出さない
		const sources = new Set(rows.map((row) => row.source));
		const hasQuantity = rows.some((row) => row.item.quantity !== null);

		const columns: Column<Transaction>[] = [
			{ header: "日時", cell: (row) => formatDateTime(row.at, toLocal) },
			{ header: "品目", cell: (row) => itemName(row.item) },
			{ header: "分類", cell: (row) => row.item.category ?? "—" },
		];
		if (hasQuantity) {
			columns.push({
				header: "数",
				numeric: true,
				cell: (row) =>
					row.item.quantity === null ? "—" : formatNumber(row.item.quantity),
			});
		}
		if (sources.size > 1) {
			columns.push({ header: "入手元", cell: (row) => row.source ?? "—" });
		}
		columns.push({
			header: "支払い",
			numeric: true,
			cell: (row) => formatSpent(row.deltas),
		});
		return { rows, keys, flows, columns };
	}, [transactions, toLocal]);

	return (
		<ListCard
			title="購入の一覧"
			description={description}
			summary={
				flows.length > 0 ? (
					<InlineFacts
						items={flows.map((flow) => ({
							label: flow.currency,
							value: (
								<>
									<strong>{formatNumber(flow.spent)}</strong>（
									{formatNumber(flow.spentCount)} 件）
								</>
							),
						}))}
					/>
				) : undefined
			}
			columns={columns}
			rows={rows}
			rowKey={(row) => keys.get(row) ?? row.at}
			empty="この期間に、購入の記録はありません。"
		/>
	);
}
