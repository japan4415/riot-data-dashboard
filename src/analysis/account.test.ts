import { describe, expect, it } from "vitest";
import type {
	AccountEvent,
	ChatLog,
	Penalty,
	SupportTicket,
} from "../model/types.ts";
import {
	accountEvents,
	chatSummary,
	ipUsage,
	penalties,
	tickets,
} from "./account.ts";
import { fixedOffset } from "./localTime.ts";
import { ALL_PERIOD } from "./period.ts";
import { at, datasetOf, login, payment, transaction } from "./testing.ts";

const jst = fixedOffset(540);
const year = (value: number) => ({ kind: "year", year: value }) as const;

function event(iso: string, type: string): AccountEvent {
	return { at: at(iso), type, description: null, source: "v2" };
}

function penalty(iso: string | null): Penalty {
	return {
		at: iso === null ? null : at(iso),
		scope: "LEAGUE_OF_LEGENDS",
		restrictionType: "CHAT_RESTRICTION",
		reason: null,
		sentence: null,
		status: null,
		isManual: false,
	};
}

describe("accountEvents / penalties", () => {
	const dataset = datasetOf({
		accountEvents: [
			event("2020-01-01T00:00:00Z", "A"),
			event("2022-01-01T00:00:00Z", "B"),
			event("2021-01-01T00:00:00Z", "C"),
		],
		penalties: [
			penalty("2018-01-02T03:04:05Z"),
			penalty(null),
			penalty("2019-01-02T03:04:05Z"),
		],
	});

	it("出来事を新しい順に並べる", () => {
		expect(
			accountEvents(dataset, ALL_PERIOD, jst).map((item) => item.type),
		).toEqual(["B", "C", "A"]);
	});

	it("出来事を年で絞り込む", () => {
		expect(
			accountEvents(dataset, year(2021), jst).map((item) => item.type),
		).toEqual(["C"]);
	});

	it("日時が分からないペナルティは、全期間のときだけ、末尾に含める", () => {
		expect(penalties(dataset, ALL_PERIOD, jst).map((item) => item.at)).toEqual([
			at("2019-01-02T03:04:05Z"),
			at("2018-01-02T03:04:05Z"),
			null,
		]);
		expect(penalties(dataset, year(2018), jst)).toHaveLength(1);
	});
});

describe("tickets", () => {
	const ticket = (
		id: string,
		iso: string | null,
		comments: Array<[string | null, string]>,
	): SupportTicket => ({
		id,
		subject: null,
		status: null,
		createdAt: iso === null ? null : at(iso),
		comments: comments.map(([time, text]) => ({
			author: "Player",
			at: time === null ? null : at(time),
			text,
		})),
	});
	const dataset = datasetOf({
		tickets: [
			ticket("1", "2021-01-01T00:00:00Z", [
				["2021-01-03T00:00:00Z", "あと"],
				[null, "時刻なし"],
				["2021-01-02T00:00:00Z", "さき"],
			]),
			ticket("2", "2023-01-01T00:00:00Z", []),
		],
	});

	it("問い合わせを新しい順に、やりとりを古い順に並べる", () => {
		const result = tickets(dataset, ALL_PERIOD, jst);
		expect(result.map((item) => item.id)).toEqual(["2", "1"]);
		expect(result[1]?.comments.map((comment) => comment.text)).toEqual([
			"さき",
			"あと",
			"時刻なし",
		]);
	});

	it("作成した年で絞り込む", () => {
		expect(tickets(dataset, year(2021), jst).map((item) => item.id)).toEqual([
			"1",
		]);
	});

	it("元のデータを並べ替えない", () => {
		tickets(dataset, ALL_PERIOD, jst);
		expect(dataset.tickets[0]?.comments[0]?.text).toBe("あと");
	});
});

describe("chatSummary", () => {
	const log = (
		gameId: string,
		iso: string,
		texts: Array<[number, string]>,
	): ChatLog => ({
		game: "lol",
		gameId,
		matchDate: at(iso),
		matchDateIsDateOnly: true,
		platform: "jp1",
		messages: texts.map(([time, text]) => ({
			phase: "inGame",
			at: time,
			sender: "Tester#JP1",
			sentTo: "TEAM",
			text,
		})),
	});
	const dataset = datasetOf({
		chatLogs: [
			log("1", "2026-01-02T00:00:00Z", [
				[2000, "gg"],
				[1000, "gl hf"],
			]),
			log("2", "2026-01-03T00:00:00Z", []),
			log("3", "2026-01-04T00:00:00Z", [[3000, "wp"]]),
			log("4", "2025-06-01T00:00:00Z", []),
		],
	});

	it("発言があった試合を新しい順に並べ、発言が無い試合は数だけを返す", () => {
		const summary = chatSummary(dataset, ALL_PERIOD, jst);
		expect(summary).toMatchObject({
			matches: 4,
			silentMatches: 2,
			messages: 3,
		});
		expect(summary.logs.map((item) => item.gameId)).toEqual(["3", "1"]);
	});

	it("発言を古い順に並べる", () => {
		const summary = chatSummary(dataset, ALL_PERIOD, jst);
		expect(summary.logs[1]?.messages.map((message) => message.text)).toEqual([
			"gl hf",
			"gg",
		]);
	});

	it("試合日の年で絞り込む", () => {
		expect(chatSummary(dataset, year(2025), jst)).toEqual({
			matches: 1,
			silentMatches: 1,
			messages: 0,
			logs: [],
		});
	});
});

describe("ipUsage", () => {
	const withIp = <T extends { ip: string | null }>(item: T, ip: string): T => ({
		...item,
		ip,
	});
	const dataset = datasetOf({
		logins: [
			withIp(login("2020-01-01T00:00:00Z", "lol-tft-pc"), "203.0.113.7"),
			withIp(login("2022-01-01T00:00:00Z", "lol-tft-pc"), "203.0.113.7"),
			withIp(login("2021-01-01T00:00:00Z", "valorant"), "2001:db8::1"),
			// アドレスの記録が無いものは数えない
			login("2021-06-01T00:00:00Z", "valorant"),
		],
		payments: [
			withIp(payment("2021-02-01T00:00:00Z", "JPY", 100, "lol"), "203.0.113.7"),
		],
		transactions: [
			withIp(transaction("2019-01-01T00:00:00Z"), "203.0.113.7"),
			withIp(transaction("2023-01-01T00:00:00Z"), "198.51.100.9"),
		],
	});

	it("アドレスごとに回数と最初、最後の時刻をまとめ、回数が多い順に並べる", () => {
		expect(ipUsage(dataset, ALL_PERIOD, jst)).toEqual([
			{
				ip: "203.0.113.7",
				count: 4,
				first: at("2019-01-01T00:00:00Z"),
				last: at("2022-01-01T00:00:00Z"),
				sources: { login: 2, payment: 1, store: 1 },
			},
			// 回数が同じなら、最後の記録が新しいものを先にする
			{
				ip: "198.51.100.9",
				count: 1,
				first: at("2023-01-01T00:00:00Z"),
				last: at("2023-01-01T00:00:00Z"),
				sources: { login: 0, payment: 0, store: 1 },
			},
			{
				ip: "2001:db8::1",
				count: 1,
				first: at("2021-01-01T00:00:00Z"),
				last: at("2021-01-01T00:00:00Z"),
				sources: { login: 1, payment: 0, store: 0 },
			},
		]);
	});

	it("年で絞り込むと、その年の記録だけを数える", () => {
		expect(ipUsage(dataset, year(2021), jst)).toEqual([
			{
				ip: "203.0.113.7",
				count: 1,
				first: at("2021-02-01T00:00:00Z"),
				last: at("2021-02-01T00:00:00Z"),
				sources: { login: 0, payment: 1, store: 0 },
			},
			{
				ip: "2001:db8::1",
				count: 1,
				first: at("2021-01-01T00:00:00Z"),
				last: at("2021-01-01T00:00:00Z"),
				sources: { login: 1, payment: 0, store: 0 },
			},
		]);
	});

	it("記録が無ければ空", () => {
		expect(ipUsage(datasetOf({}), ALL_PERIOD, jst)).toEqual([]);
	});
});
