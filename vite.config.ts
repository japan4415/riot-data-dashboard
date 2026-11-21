import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { securityHeaders } from "./build/security-headers.ts";

export default defineConfig({
	plugins: [react(), cloudflare(), securityHeaders()],
	build: {
		// 事前読み込みの代替実装は fetch を使うため、通信を禁止する方針と両立しない
		modulePreload: { polyfill: false },
	},
});
