/** 中央値。件数が偶数のときは、中央の 2 つの平均。値が無ければ null。 */
export function median(values: readonly number[]): number | null {
	if (values.length === 0) {
		return null;
	}
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	const upper = sorted[middle];
	const lower = sorted[middle - 1];
	if (upper === undefined) {
		return null;
	}
	return sorted.length % 2 === 0 && lower !== undefined
		? (lower + upper) / 2
		: upper;
}

/**
 * 最小値と最大値。値が無ければ null。
 *
 * `Math.max(...values)` は、件数が多いと引数の数の上限に当たるので使わない。
 */
export function extent(
	values: Iterable<number>,
): { min: number; max: number } | null {
	let min = Number.POSITIVE_INFINITY;
	let max = Number.NEGATIVE_INFINITY;
	for (const value of values) {
		if (value < min) {
			min = value;
		}
		if (value > max) {
			max = value;
		}
	}
	return min <= max ? { min, max } : null;
}
