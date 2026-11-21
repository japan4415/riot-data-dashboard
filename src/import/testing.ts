import type { Adapter, Contribution } from "./adapter.ts";

/** テスト用。変換関数を実行し、結果と飛ばした件数を返す。 */
export function runAdapter(
	adapter: Adapter,
	json: unknown,
	path = "test.json",
): { result: Contribution; skipped: number } {
	let skipped = 0;
	const result = adapter(json, {
		path,
		skip() {
			skipped += 1;
		},
	});
	return { result, skipped };
}

/** テスト用。ISO 8601 の文字列をエポックミリ秒にする。 */
export function utc(iso: string): number {
	const value = Date.parse(iso);
	if (Number.isNaN(value)) {
		throw new Error(`日時として読めません: ${iso}`);
	}
	return value;
}
