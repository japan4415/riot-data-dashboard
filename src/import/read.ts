/**
 * zip の中の値を安全に読むための小さな関数群。
 *
 * 開示データは型が安定しない（数値が文字列で入る、値なしの表し方が複数ある）。
 * 変換関数はここを通して値を読み、期待と違う値は null として扱う。
 */

export type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 配列ならそのまま、そうでなければ空配列を返す。 */
export function asArray(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

/** 配列の要素のうち、オブジェクトだけを取り出す。 */
export function records(value: unknown): JsonRecord[] {
	return asArray(value).filter(isRecord);
}

/**
 * 文字列を読む。前後の空白と改行を取り除き、空文字列は null にする。
 * 途中の改行は空白 1 つに置き換える（品目名に改行が混じることがあるため）。
 */
export function text(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}
	const trimmed = value.replace(/\s*[\r\n]+\s*/g, " ").trim();
	return trimmed === "" ? null : trimmed;
}

/** 本文を読む。途中の改行を保ち、前後の空白だけを取り除く。 */
export function body(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}
	const trimmed = value.replace(/\r\n/g, "\n").trim();
	return trimmed === "" ? null : trimmed;
}

const MISSING_TOKENS = new Set(["unknown", "not applicable", "none", "null"]);

/**
 * 列挙値や名前を読む。`text` に加えて、「値なし」を表す文字列
 * （`Unknown`、`Not Applicable` など）を null にする。
 */
export function known(value: unknown): string | null {
	const read = text(value);
	if (read === null || MISSING_TOKENS.has(read.toLowerCase())) {
		return null;
	}
	return read;
}

/** 数値を読む。数値の文字列も受け付ける。 */
export function num(value: unknown): number | null {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(trimmed)) {
			return null;
		}
		return Number(trimmed);
	}
	return null;
}

/** 整数を読む。小数は null にする。 */
export function int(value: unknown): number | null {
	const read = num(value);
	return read !== null && Number.isInteger(read) ? read : null;
}

/** 真偽値を読む。`"0"` / `"1"` と 0 / 1 も受け付ける。 */
export function bool(value: unknown): boolean | null {
	if (typeof value === "boolean") {
		return value;
	}
	if (value === 1 || value === "1") {
		return true;
	}
	if (value === 0 || value === "0") {
		return false;
	}
	return null;
}

/**
 * 金額を 100 倍した整数として読む。
 *
 * `"35.0"` や `"1300.00"` のような文字列を、浮動小数点の誤差なしに変換する。
 * 小数点以下 3 桁目以降は切り捨てる。
 */
export function amountX100(value: unknown): number | null {
	const source =
		typeof value === "number" && Number.isFinite(value)
			? String(value)
			: typeof value === "string"
				? value.trim()
				: null;
	if (source === null) {
		return null;
	}
	const match = /^([+-])?(\d+)(?:\.(\d*))?$/.exec(source);
	if (!match) {
		return null;
	}
	const [, sign, whole = "0", fraction = ""] = match;
	const cents =
		Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));
	return sign === "-" ? -cents : cents;
}
