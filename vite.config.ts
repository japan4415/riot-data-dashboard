import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { securityHeaders } from "./build/security-headers.ts";

export default defineConfig({
	plugins: [react(), cloudflare(), securityHeaders()],
	build: {
		// 事前読み込みの代替実装は fetch を使うため、通信を禁止する方針と両立しない
		modulePreload: { polyfill: false },
		// League of Legends の画面は、品目名の対応表（約 500 KB）を含む。
		// この画面を開いたときにだけ読み込むので、大きさの警告の基準を対応表に合わせて上げる
		chunkSizeWarningLimit: 600,
	},
});
