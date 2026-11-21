import type { AccountProfile, DatasetCollections } from "../model/types.ts";

/** 変換関数に渡す、読み込み中のファイルの情報。 */
export interface AdapterContext {
	/** zip 内のパス。小文字にそろえ、最上位の余分なフォルダを除いてある。 */
	path: string;
	/** 読めなかったレコードを 1 件として数える。 */
	skip(): void;
}

/**
 * 1 つのファイルから得られたデータ。
 *
 * 配列は全体のデータに追加される。`account` は、null でない項目だけが
 * 全体のアカウント情報に上書きされる。
 */
export type Contribution = Partial<DatasetCollections> & {
	account?: Partial<AccountProfile>;
};

/**
 * 1 つのファイルを正規化する関数。
 *
 * - 期待と違う形の入力を受け取っても例外を出さず、読めた分だけを返す。
 * - 必須の項目が欠けたレコードは捨てて、`context.skip()` を呼ぶ。
 * - 知らない項目は無視する。
 */
export type Adapter = (json: unknown, context: AdapterContext) => Contribution;
