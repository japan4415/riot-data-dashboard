import { unzipSync } from "fflate";

export type ImportErrorCode = "not-zip" | "too-large" | "not-riot-export";

/** zip 全体を読み込めなかったことを表す。 */
export class ImportError extends Error {
	readonly code: ImportErrorCode;

	constructor(code: ImportErrorCode, message: string) {
		super(message);
		this.name = "ImportError";
		this.code = code;
	}
}

export interface ArchiveFile {
	/** zip に入っていたままのパス。 */
	originalPath: string;
	/** 小文字にそろえ、最上位の余分なフォルダを除いたパス。 */
	path: string;
	bytes: Uint8Array;
}

export interface Archive {
	/** 読み込み対象の JSON ファイル。パスの順に並ぶ。 */
	files: ArchiveFile[];
}

/** これを超える zip は、開示データではないとみなして中止する。 */
export const MAX_ENTRIES = 50_000;
export const MAX_TOTAL_BYTES = 512 * 1024 * 1024;

/**
 * 開示データの最上位に並ぶフォルダ。小文字で持つ。
 * `2XKO/` と `2xko/` のように大文字小文字だけが違うフォルダがあるので、区別しない。
 */
const KNOWN_ROOTS = new Set([
	"2xko",
	"alphi",
	"league",
	"leagueoflegends",
	"legendsofruneterra",
	"penalties",
	"riotaccount",
	"teamfighttactics",
	"valorant",
	"wildrift",
	"zendesk",
]);

function segmentsOf(name: string): string[] {
	return name
		.replaceAll("\\", "/")
		.split("/")
		.filter((segment) => segment !== "")
		.map((segment) => segment.toLowerCase());
}

/**
 * パスを小文字にそろえる。既知のフォルダより上にある余分なフォルダは取り除く
 * （展開したフォルダを圧縮し直した zip では、全体が 1 つのフォルダに包まれる）。
 */
export function normalizePath(name: string): {
	path: string;
	underKnownRoot: boolean;
} {
	const segments = segmentsOf(name);
	const rootIndex = segments.findIndex((segment) => KNOWN_ROOTS.has(segment));
	if (rootIndex === -1) {
		return { path: segments.join("/"), underKnownRoot: false };
	}
	return { path: segments.slice(rootIndex).join("/"), underKnownRoot: true };
}

function isReadable(name: string): boolean {
	if (name.endsWith("/")) {
		return false;
	}
	const segments = segmentsOf(name);
	const fileName = segments.at(-1) ?? "";
	// macOS が圧縮時に加えるファイルは読まない
	if (segments.includes("__macosx") || fileName.startsWith(".")) {
		return false;
	}
	return fileName.endsWith(".json");
}

/**
 * zip を展開し、読み込み対象の JSON ファイルを取り出す。
 *
 * JSON 以外（`readme.csv` など）は展開しない。
 */
export function openArchive(data: Uint8Array): Archive {
	let entryCount = 0;
	let totalBytes = 0;
	let unzipped: Record<string, Uint8Array>;

	try {
		unzipped = unzipSync(data, {
			filter(entry) {
				entryCount += 1;
				if (entryCount > MAX_ENTRIES) {
					throw new ImportError(
						"too-large",
						"zip に含まれるファイルが多すぎます。",
					);
				}
				if (!isReadable(entry.name)) {
					return false;
				}
				totalBytes += entry.originalSize;
				if (totalBytes > MAX_TOTAL_BYTES) {
					throw new ImportError(
						"too-large",
						"zip を展開したサイズが大きすぎます。",
					);
				}
				return true;
			},
		});
	} catch (error) {
		if (error instanceof ImportError) {
			throw error;
		}
		throw new ImportError("not-zip", "zip ファイルとして読めませんでした。");
	}

	let foundKnownRoot = false;
	const files: ArchiveFile[] = [];
	for (const [originalPath, bytes] of Object.entries(unzipped)) {
		const { path, underKnownRoot } = normalizePath(originalPath);
		foundKnownRoot ||= underKnownRoot;
		files.push({ originalPath, path, bytes });
	}

	if (!foundKnownRoot) {
		throw new ImportError(
			"not-riot-export",
			"Riot Games の開示データが見つかりませんでした。",
		);
	}

	files.sort((a, b) =>
		a.path < b.path
			? -1
			: a.path > b.path
				? 1
				: a.originalPath < b.originalPath
					? -1
					: 1,
	);
	return { files };
}
