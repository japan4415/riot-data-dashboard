import { defineConfig } from "cf/config";

// スクリプトを持たず、静的アセットだけを配信する Worker。
// 利用者のデータはブラウザの中だけで処理し、ここには届かない。
export default defineConfig({
	worker: {
		name: "riot-data-dashboard",
		compatibilityDate: "2026-11-01",
		assets: {
			notFoundHandling: "single-page-application",
		},
		domains: ["riot-data-dashboard.discord.jp"],
	},
});
