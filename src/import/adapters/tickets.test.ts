import { describe, expect, it } from "vitest";
import { runAdapter, utc } from "../testing.ts";
import { tickets } from "./tickets.ts";

function comment(overrides: Record<string, unknown> = {}) {
	return {
		author: "Player",
		comment: "Hello,\r\nI have a question.",
		create_datetime: "2024-03-01 10:00:00",
		...overrides,
	};
}

function ticket(overrides: Record<string, unknown> = {}) {
	return {
		ticket_id: "1001",
		subject: "Account question",
		status: "closed",
		create_datetime: "2024-03-01 09:59:00",
		comments: [comment()],
		...overrides,
	};
}

describe("tickets", () => {
	it("問い合わせを正規化する", () => {
		const { result, skipped } = runAdapter(tickets, { "1001": ticket() });

		expect(skipped).toBe(0);
		expect(result.tickets).toEqual([
			{
				id: "1001",
				subject: "Account question",
				status: "closed",
				createdAt: utc("2024-03-01T09:59:00Z"),
				comments: [
					{
						author: "Player",
						at: utc("2024-03-01T10:00:00Z"),
						text: "Hello,\nI have a question.",
					},
				],
			},
		]);
	});

	it("本文の改行を保ち、前後の空白だけを取り除く", () => {
		const { result } = runAdapter(tickets, {
			"1001": ticket({
				comments: [comment({ comment: "\n  line 1\r\n\r\nline 3  \n" })],
			}),
		});

		expect(result.tickets?.[0]?.comments[0]?.text).toBe("line 1\n\nline 3");
	});

	it("チケット ID が無い場合はキーを使う", () => {
		const { result } = runAdapter(tickets, {
			"2002": ticket({ ticket_id: null }),
			"2003": ticket({ ticket_id: "" }),
			"2004": ticket({ ticket_id: undefined }),
		});

		expect(result.tickets?.map((item) => item.id)).toEqual([
			"2002",
			"2003",
			"2004",
		]);
	});

	it("チケット ID がキーと違う場合は項目の値を優先する", () => {
		const { result } = runAdapter(tickets, {
			"2002": ticket({ ticket_id: "3003" }),
		});

		expect(result.tickets?.[0]?.id).toBe("3003");
	});

	it.each([
		["open", "open"],
		["deleted", "deleted"],
		["Unknown", null],
		["", null],
		[null, null],
		[1, null],
	])("状態の %j を %j として読む", (status, expected) => {
		const { result } = runAdapter(tickets, { "1001": ticket({ status }) });

		expect(result.tickets?.[0]?.status).toBe(expected);
	});

	it.each([
		["null", null],
		["空文字列", ""],
		["文字列でない", 5],
	])("件名が %s の場合は null にする", (_name, subject) => {
		const { result } = runAdapter(tickets, { "1001": ticket({ subject }) });

		expect(result.tickets?.[0]?.subject).toBeNull();
	});

	it("作成日時が読めない場合も、チケットを残して null にする", () => {
		const { result, skipped } = runAdapter(tickets, {
			"1001": ticket({ create_datetime: "not a date" }),
		});

		expect(skipped).toBe(0);
		expect(result.tickets?.[0]?.createdAt).toBeNull();
	});

	it("書き手と投稿日時が読めない場合も、本文があれば残す", () => {
		const { result, skipped } = runAdapter(tickets, {
			"1001": ticket({
				comments: [comment({ author: "Unknown", create_datetime: null })],
			}),
		});

		expect(skipped).toBe(0);
		expect(result.tickets?.[0]?.comments).toEqual([
			{ author: null, at: null, text: "Hello,\nI have a question." },
		]);
	});

	it("本文の無いやりとりは捨てて、件数を数える", () => {
		const { result, skipped } = runAdapter(tickets, {
			"1001": ticket({
				comments: [
					comment({ comment: null }),
					comment({ comment: "" }),
					comment({ comment: " \r\n " }),
					comment({ comment: 123 }),
					"broken",
					null,
					comment({ comment: "kept" }),
				],
			}),
		});

		expect(skipped).toBe(6);
		expect(result.tickets?.[0]?.comments.map((item) => item.text)).toEqual([
			"kept",
		]);
	});

	it.each([
		["配列でない", { unexpected: true }],
		["null", null],
		["項目が無い", undefined],
	])("comments が %s の場合は空にする", (_name, comments) => {
		const { result, skipped } = runAdapter(tickets, {
			"1001": ticket({ comments }),
		});

		expect(skipped).toBe(0);
		expect(result.tickets?.[0]?.comments).toEqual([]);
	});

	it("複数のチケットを、キーの並びのまま返す", () => {
		const { result } = runAdapter(tickets, {
			"1": ticket({ ticket_id: "1" }),
			"2": ticket({ ticket_id: "2" }),
		});

		expect(result.tickets?.map((item) => item.id)).toEqual(["1", "2"]);
	});

	it("オブジェクトでないチケットは飛ばす", () => {
		const { result, skipped } = runAdapter(tickets, {
			"1": "broken",
			"2": null,
			"3": [ticket()],
			"4": ticket({ ticket_id: "4" }),
		});

		expect(skipped).toBe(3);
		expect(result.tickets?.map((item) => item.id)).toEqual(["4"]);
	});

	it("オブジェクトでない入力には空の結果を返す", () => {
		expect(runAdapter(tickets, [ticket()]).result).toEqual({ tickets: [] });
		expect(runAdapter(tickets, null).result).toEqual({ tickets: [] });
		expect(runAdapter(tickets, {}).result).toEqual({ tickets: [] });
	});
});
