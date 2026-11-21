import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Cloudflare 用のプラグインはテストに不要なので、vite.config.ts とは別に定義する。
// 既定は node 環境。画面のテストは、ファイル先頭の `@vitest-environment jsdom` で切り替える。
export default defineConfig({
	plugins: [react()],
	test: {
		environment: "node",
		include: ["src/**/*.test.{ts,tsx}", "build/**/*.test.ts"],
	},
});
