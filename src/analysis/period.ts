/** 表示する期間。全期間、または 1 年分。 */
export type Period = { kind: "all" } | { kind: "year"; year: number };

export const ALL_PERIOD: Period = { kind: "all" };

export function inPeriod(period: Period, year: number): boolean {
	return period.kind === "all" || period.year === year;
}

export function periodLabel(period: Period): string {
	return period.kind === "all" ? "全期間" : `${period.year} 年`;
}
