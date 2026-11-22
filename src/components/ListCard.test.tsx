// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Column } from "./DataTable.tsx";
import { ListCard } from "./ListCard.tsx";

afterEach(cleanup);

const COLUMNS: Column<number>[] = [
	{ header: "番号", cell: (row) => `${row} 番` },
];

function numbers(count: number): number[] {
	return Array.from({ length: count }, (_, index) => index + 1);
}

function List({ rows }: { rows: readonly number[] }) {
	return (
		<ListCard
			title="一覧"
			columns={COLUMNS}
			rows={rows}
			rowKey={(row) => row}
			pageSize={10}
		/>
	);
}

function firstRow(): string | null | undefined {
	return screen.getAllByRole("rowheader")[0]?.textContent;
}

function next() {
	fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
}

describe("ListCard", () => {
	it("1 ページに収まるときは、件数だけを示し、ページの切り替えを出さない", () => {
		render(<List rows={numbers(10)} />);

		expect(screen.getByText("全 10 件")).toBeDefined();
		expect(screen.queryByRole("button", { name: "次のページ" })).toBeNull();
	});

	it("ページを進めたり戻したりできる", () => {
		render(<List rows={numbers(25)} />);

		expect(screen.getByText("1〜10 件目（全 25 件）")).toBeDefined();
		next();
		next();
		expect(screen.getByText("21〜25 件目（全 25 件）")).toBeDefined();
		expect(firstRow()).toBe("21 番");

		fireEvent.click(screen.getByRole("button", { name: "前のページ" }));
		expect(firstRow()).toBe("11 番");
	});

	it("行が入れ替わったら、先頭のページに戻す", () => {
		const { rerender } = render(<List rows={numbers(25)} />);
		next();
		expect(firstRow()).toBe("11 番");

		rerender(<List rows={numbers(30)} />);

		expect(firstRow()).toBe("1 番");
		expect(screen.getByText("1〜10 件目（全 30 件）")).toBeDefined();
	});

	it("行が減って 1 ページに収まったら、ページの切り替えを消す", () => {
		const { rerender } = render(<List rows={numbers(25)} />);
		next();
		next();

		rerender(<List rows={numbers(3)} />);

		expect(firstRow()).toBe("1 番");
		expect(screen.getByText("全 3 件")).toBeDefined();
		expect(screen.queryByRole("button", { name: "次のページ" })).toBeNull();
	});

	it("行が無いときは、その旨を表示する", () => {
		render(<List rows={[]} />);

		expect(screen.getByText("記録がありません。")).toBeDefined();
		expect(screen.getByText("全 0 件")).toBeDefined();
	});
});
