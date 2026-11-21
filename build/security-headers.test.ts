import { describe, expect, it } from "vitest";
import {
	contentSecurityPolicy,
	metaContentSecurityPolicy,
	renderHeadersFile,
} from "./security-headers.ts";

describe("コンテンツセキュリティポリシー", () => {
	it("外部への通信を禁止する", () => {
		expect(contentSecurityPolicy).toContain("connect-src 'none'");
		expect(contentSecurityPolicy).toContain("default-src 'none'");
	});

	it("スクリプト、画像、フォントの読み込み元を同一オリジンに限る", () => {
		expect(contentSecurityPolicy).toContain("script-src 'self'");
		expect(contentSecurityPolicy).toContain("img-src 'self' data: blob:");
		expect(contentSecurityPolicy).toContain("font-src 'self'");
		expect(contentSecurityPolicy).not.toMatch(/https?:/);
		expect(contentSecurityPolicy).not.toContain("unsafe-eval");
	});

	it("meta 要素用のポリシーからは、meta で無視されるディレクティブを除く", () => {
		expect(contentSecurityPolicy).toContain("frame-ancestors 'none'");
		expect(metaContentSecurityPolicy).not.toContain("frame-ancestors");
		expect(metaContentSecurityPolicy).toContain("connect-src 'none'");
	});
});

describe("_headers ファイル", () => {
	it("全パスにポリシーを付ける", () => {
		const lines = renderHeadersFile().split("\n");
		expect(lines[0]).toBe("/*");
		expect(lines).toContain(
			`  Content-Security-Policy: ${contentSecurityPolicy}`,
		);
		expect(lines).toContain("  X-Content-Type-Options: nosniff");
	});

	it("ヘッダーの行はすべて字下げされている", () => {
		const lines = renderHeadersFile().trimEnd().split("\n").slice(1);
		expect(lines.length).toBeGreaterThan(0);
		for (const line of lines) {
			expect(line).toMatch(/^ {2}[A-Za-z-]+: \S/);
		}
	});
});
