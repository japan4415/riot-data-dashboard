import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { ImportError, normalizePath, openArchive } from "./archive.ts";

function zip(files: Record<string, string>): Uint8Array {
	return zipSync(
		Object.fromEntries(
			Object.entries(files).map(([path, content]) => [path, strToU8(content)]),
		),
	);
}

function errorCodeOf(run: () => unknown): string | null {
	try {
		run();
		return null;
	} catch (error) {
		return error instanceof ImportError ? error.code : "unexpected";
	}
}

describe("normalizePath", () => {
	it("小文字にそろえる", () => {
		expect(normalizePath("riotAccount/account_info.json")).toEqual({
			path: "riotaccount/account_info.json",
			underKnownRoot: true,
		});
	});

	it("大文字小文字だけが違うフォルダを同じものとして扱う", () => {
		expect(normalizePath("2XKO/2xko_chat_logs_uc.json").path).toBe(
			"2xko/2xko_chat_logs_uc.json",
		);
		expect(normalizePath("2xko/2xko_audio_transcripts_uc.json").path).toBe(
			"2xko/2xko_audio_transcripts_uc.json",
		);
	});

	it("既知のフォルダより上にある余分なフォルダを取り除く", () => {
		expect(
			normalizePath("Player-JP1/valorant/valorant_match_history_uc.json"),
		).toEqual({
			path: "valorant/valorant_match_history_uc.json",
			underKnownRoot: true,
		});
	});

	it("Windows 形式の区切りを受け付ける", () => {
		expect(normalizePath("wildrift\\wildrift_currency.json").path).toBe(
			"wildrift/wildrift_currency.json",
		);
	});

	it("既知のフォルダに無いパスは、そのまま小文字にする", () => {
		expect(normalizePath("NewGame/Data.json")).toEqual({
			path: "newgame/data.json",
			underKnownRoot: false,
		});
	});
});

describe("openArchive", () => {
	it("JSON ファイルだけを取り出し、パスの順に並べる", () => {
		const archive = openArchive(
			zip({
				"valorant/valorant_match_history_uc.json": "[]",
				"readme.csv": "text\nREADME",
				"riotAccount/account_info.json": "{}",
			}),
		);

		expect(archive.files.map((file) => file.path)).toEqual([
			"riotaccount/account_info.json",
			"valorant/valorant_match_history_uc.json",
		]);
		expect(archive.files[0]?.originalPath).toBe(
			"riotAccount/account_info.json",
		);
		expect(new TextDecoder().decode(archive.files[0]?.bytes)).toBe("{}");
	});

	it("大文字小文字だけが違うフォルダのファイルを両方とも読む", () => {
		const archive = openArchive(
			zip({
				"2XKO/2xko_chat_logs_uc.json": "[]",
				"2xko/2xko_audio_transcripts_uc.json": "[]",
				"riotAccount/account_info.json": "{}",
			}),
		);

		expect(archive.files.map((file) => file.path)).toEqual([
			"2xko/2xko_audio_transcripts_uc.json",
			"2xko/2xko_chat_logs_uc.json",
			"riotaccount/account_info.json",
		]);
	});

	it("macOS が加えるファイルと隠しファイルを読まない", () => {
		const archive = openArchive(
			zip({
				"__MACOSX/riotAccount/._account_info.json": "x",
				"riotAccount/.hidden.json": "{}",
				"riotAccount/account_info.json": "{}",
			}),
		);

		expect(archive.files.map((file) => file.path)).toEqual([
			"riotaccount/account_info.json",
		]);
	});

	it("既知のフォルダに無い JSON も、未対応として扱えるよう取り出す", () => {
		const archive = openArchive(
			zip({
				"newgame/data.json": "[1]",
				"riotAccount/account_info.json": "{}",
			}),
		);

		expect(archive.files.map((file) => file.path)).toContain(
			"newgame/data.json",
		);
	});

	it("zip でないデータは not-zip", () => {
		expect(errorCodeOf(() => openArchive(strToU8("これは zip ではない")))).toBe(
			"not-zip",
		);
		expect(errorCodeOf(() => openArchive(new Uint8Array()))).toBe("not-zip");
	});

	it("開示データのフォルダが 1 つも無い zip は not-riot-export", () => {
		expect(
			errorCodeOf(() => openArchive(zip({ "photos/list.json": "[]" }))),
		).toBe("not-riot-export");
		expect(errorCodeOf(() => openArchive(zip({ "notes.txt": "memo" })))).toBe(
			"not-riot-export",
		);
	});
});
