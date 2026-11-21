import { describe, expect, it } from "vitest";
import { buildSyntheticZip } from "../../tests/fixtures/syntheticExport.ts";
import { ImportError } from "./archive.ts";
import { importArchive, type ReportEntry } from "./importArchive.ts";
import { FILE_KINDS, findFileKind } from "./registry.ts";
import { utc } from "./testing.ts";

function entryOf(entries: readonly ReportEntry[], id: string): ReportEntry {
	const entry = entries.find((candidate) => candidate.id === id);
	if (!entry) {
		throw new Error(`読み込み結果に ${id} がありません`);
	}
	return entry;
}

describe("importArchive", () => {
	const { dataset, report } = importArchive(buildSyntheticZip());

	it("アカウント情報を複数のファイルからまとめる", () => {
		expect(dataset.account).toEqual({
			riotId: { gameName: "Tester", tagLine: "JP1" },
			username: "tester",
			email: "player@example.com",
			dateOfBirth: "2000-01-02",
			phoneNumber: "+81******0000",
			lolPlatform: "JP1",
		});
	});

	it("各種類のデータを読み込む", () => {
		expect(dataset.logins).toHaveLength(3);
		expect(dataset.matches.map((match) => match.game).sort()).toEqual([
			"lor",
			"lor",
			"valorant",
			"valorant",
			"valorant",
			"wildrift",
			"wildrift",
		]);
		expect(dataset.payments.map((payment) => payment.game).sort()).toEqual([
			"lol",
			"lol",
			"lor",
			"valorant",
		]);
		expect(dataset.transactions).toHaveLength(6);
		expect(dataset.inventory).toHaveLength(8);
		expect(dataset.balances).toHaveLength(3);
		expect(dataset.accountEvents).toHaveLength(4);
		expect(dataset.penalties).toHaveLength(1);
		expect(dataset.reports).toEqual([
			{ game: "lol", direction: "made", category: "LEAVING_AFK", count: 2 },
		]);
		expect(dataset.chatLogs.map((log) => log.game)).toEqual([
			"lol",
			"lol",
			"tft",
		]);
		expect(dataset.tickets).toHaveLength(1);
	});

	it("時刻の昇順に並べ、時刻が無いものを末尾に置く", () => {
		expect(dataset.logins.map((login) => login.at)).toEqual([
			utc("2020-01-01T12:00:00Z"),
			utc("2023-06-01T20:00:00Z"),
			utc("2024-03-01T09:55:00Z"),
		]);

		const startTimes = dataset.matches.map((match) => match.startedAt);
		expect(startTimes.at(-1)).toBeNull();
		const known = startTimes.filter((time) => time !== null);
		expect(known).toEqual([...known].sort((a, b) => a - b));
	});

	it("金額を 100 倍した整数にそろえる", () => {
		const amounts = dataset.payments.map(
			(payment) => `${payment.game} ${payment.currency} ${payment.amountX100}`,
		);
		expect(amounts.sort()).toEqual([
			"lol JPY 130000",
			"lol USD 1200",
			"lor JPY 60000",
			"valorant JPY 120000",
		]);
	});

	it("種類ごとに件数と状態をまとめる", () => {
		expect(entryOf(report.entries, "logins")).toMatchObject({
			status: "loaded",
			records: 3,
			skipped: 1,
			failedFiles: 0,
			paths: ["riotAccount/atlas_login_event_uc.json"],
		});
		expect(entryOf(report.entries, "valorant-matches")).toMatchObject({
			status: "loaded",
			records: 3,
		});
		expect(entryOf(report.entries, "account-info")).toMatchObject({
			status: "loaded",
			records: 1,
		});
	});

	it("1 試合 1 ファイルのチャットログを 1 行にまとめる", () => {
		const entry = entryOf(report.entries, "lol-chat");

		expect(entry.paths).toHaveLength(2);
		expect(entry.records).toBe(2);
		expect(entry.status).toBe("loaded");
	});

	it("記録が無いファイルは empty にする", () => {
		expect(entryOf(report.entries, "tft-reports").status).toBe("empty");
		expect(entryOf(report.entries, "valorant-reports").status).toBe("empty");
	});

	it("対応表に無いファイルは、空なら empty、中身があれば unsupported にする", () => {
		const { report: withUnknown } = importArchive(
			buildSyntheticZip({
				extra: { "2XKO/2xko_game_match_history_uc.json": [{ id: 1 }] },
			}),
		);

		expect(
			entryOf(withUnknown.entries, "2xko/2xko_game_match_history_uc.json"),
		).toMatchObject({ status: "unsupported", game: "2xko", records: 0 });
		expect(
			entryOf(withUnknown.entries, "2xko/2xko_audio_transcripts_uc.json"),
		).toMatchObject({ status: "empty", game: "2xko" });
		expect(withUnknown.totals.unsupportedFiles).toBe(1);
	});

	it("大文字小文字だけが違うフォルダのファイルを両方とも結果に載せる", () => {
		const paths = report.entries.flatMap((entry) => entry.paths);

		expect(paths).toContain("2XKO/2xko_game_match_history_uc.json");
		expect(paths).toContain("2xko/2xko_audio_transcripts_uc.json");
	});

	it("対応しているファイルを対応表の順に、それ以外をあとに並べる", () => {
		const ids = report.entries.map((entry) => entry.id);
		const knownIds = ids.filter((id) =>
			FILE_KINDS.some((kind) => kind.id === id),
		);

		expect(knownIds).toEqual(
			FILE_KINDS.map((kind) => kind.id).filter((id) => ids.includes(id)),
		);
		expect(ids.slice(knownIds.length).every((id) => id.includes("/"))).toBe(
			true,
		);
	});

	it("合計を集計する", () => {
		expect(report.totals.files).toBe(
			report.entries.reduce((sum, entry) => sum + entry.paths.length, 0),
		);
		expect(report.totals.skipped).toBe(1);
		expect(report.totals.failedFiles).toBe(0);
		expect(report.totals.unsupportedFiles).toBe(0);
	});

	it("壊れた JSON があっても、ほかのファイルは読み込む", () => {
		const result = importArchive(
			buildSyntheticZip({
				extra: {
					"valorant/valorant_match_history_uc.json": "{ これは JSON ではない",
				},
			}),
		);

		expect(entryOf(result.report.entries, "valorant-matches")).toMatchObject({
			status: "failed",
			records: 0,
			failedFiles: 1,
		});
		expect(result.dataset.matches.some((match) => match.game === "lor")).toBe(
			true,
		);
		expect(result.dataset.logins).toHaveLength(3);
	});

	it("期待と違う形のファイルがあっても止まらない", () => {
		const result = importArchive(
			buildSyntheticZip({
				extra: {
					"riotAccount/atlas_login_event_uc.json": { unexpected: true },
					"wildrift/wildrift_inventory.json": [1, 2, 3],
					"zendesk/zendesk_tickets.json": "text",
				},
			}),
		);

		expect(result.dataset.logins).toEqual([]);
		expect(result.dataset.inventory).toEqual([]);
		expect(result.dataset.tickets).toEqual([]);
		expect(result.dataset.matches.length).toBeGreaterThan(0);
	});

	it("ファイルが欠けていても読み込む", () => {
		const result = importArchive(
			buildSyntheticZip({
				omit: [
					"riotAccount/account_info.json",
					"valorant/valorant_match_history_uc.json",
				],
			}),
		);

		expect(result.dataset.account.email).toBeNull();
		expect(result.dataset.account.riotId).toEqual({
			gameName: "Tester",
			tagLine: "JP1",
		});
		expect(
			result.report.entries.some((entry) => entry.id === "valorant-matches"),
		).toBe(false);
	});

	it("全体が 1 つのフォルダに包まれた zip も読み込む", () => {
		const result = importArchive(buildSyntheticZip({ wrapper: "Tester-JP1" }));

		expect(result.dataset.logins).toHaveLength(3);
		expect(entryOf(result.report.entries, "logins").paths).toEqual([
			"Tester-JP1/riotAccount/atlas_login_event_uc.json",
		]);
	});

	it("zip でないデータには ImportError を投げる", () => {
		expect(() => importArchive(new Uint8Array([1, 2, 3]))).toThrow(ImportError);
	});
});

describe("対応表", () => {
	it("1 つのパスに複数の種類が当てはまらない", () => {
		const paths = [
			"riotaccount/account_info.json",
			"leagueoflegends/chat_logs_v2_uc/successes/1.json",
			"teamfighttactics/tft_chat_logs_v2_uc/successes/1.json",
			"leagueoflegends/grouped_reports.json",
			"valorant/valorant_grouped_reports.json",
			"wildrift/wildrift_purchase_event_uc.json",
		];
		for (const path of paths) {
			expect(FILE_KINDS.filter((kind) => kind.pattern.test(path))).toHaveLength(
				1,
			);
		}
	});

	it("ID が重複していない", () => {
		const ids = FILE_KINDS.map((kind) => kind.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("対応していないパスには null を返す", () => {
		expect(findFileKind("wildrift/wildrift_payment_event_uc.json")).toBeNull();
		expect(findFileKind("2xko/2xko_chat_logs_uc.json")).toBeNull();
	});
});
