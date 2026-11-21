import type { Plugin } from "vite";

/**
 * 利用者のデータをブラウザの外へ出さないためのコンテンツセキュリティポリシー。
 *
 * `connect-src 'none'` により、コードに不備があっても fetch や XHR、WebSocket での
 * 送信をブラウザが止める。画像やフォントも同一オリジンに限り、URL に埋め込んだ
 * データを外部へ運ぶ経路を閉じる。
 */
const directives: ReadonlyArray<readonly [name: string, value: string]> = [
	["default-src", "'none'"],
	["script-src", "'self'"],
	["style-src", "'self'"],
	["img-src", "'self' data: blob:"],
	["font-src", "'self'"],
	["connect-src", "'none'"],
	["worker-src", "'self' blob:"],
	["manifest-src", "'self'"],
	["base-uri", "'none'"],
	["form-action", "'none'"],
	["frame-ancestors", "'none'"],
];

/** `meta` 要素では無視されるディレクティブ。ヘッダーでだけ指定する。 */
const headerOnly = new Set(["frame-ancestors"]);

function serialize(
	entries: ReadonlyArray<readonly [name: string, value: string]>,
): string {
	return entries.map(([name, value]) => `${name} ${value}`).join("; ");
}

export const contentSecurityPolicy = serialize(directives);

export const metaContentSecurityPolicy = serialize(
	directives.filter(([name]) => !headerOnly.has(name)),
);

const headers: ReadonlyArray<readonly [name: string, value: string]> = [
	["Content-Security-Policy", contentSecurityPolicy],
	["X-Content-Type-Options", "nosniff"],
	["X-Frame-Options", "DENY"],
	["Referrer-Policy", "no-referrer"],
	["Cross-Origin-Opener-Policy", "same-origin"],
	[
		"Permissions-Policy",
		"camera=(), geolocation=(), microphone=(), payment=(), usb=()",
	],
];

/** 静的アセットに添える `_headers` ファイルの中身。全パスに同じヘッダーを付ける。 */
export function renderHeadersFile(): string {
	const lines = headers.map(([name, value]) => `  ${name}: ${value}`);
	return `/*\n${lines.join("\n")}\n`;
}

/**
 * 本番のビルドにだけセキュリティ関連のヘッダーを加える。
 *
 * 開発時の自動再読み込みは WebSocket を使うので、開発サーバーには適用しない。
 * ヘッダーは `_headers` ファイルで配信し、それが効かない環境に備えて
 * 同じポリシーを `meta` 要素にも入れる。
 */
export function securityHeaders(): Plugin {
	return {
		name: "riot-data-dashboard:security-headers",
		apply: "build",
		transformIndexHtml() {
			return [
				{
					tag: "meta",
					attrs: {
						"http-equiv": "Content-Security-Policy",
						content: metaContentSecurityPolicy,
					},
					injectTo: "head-prepend",
				},
			];
		},
		generateBundle() {
			this.emitFile({
				type: "asset",
				fileName: "_headers",
				source: renderHeadersFile(),
			});
		},
	};
}
