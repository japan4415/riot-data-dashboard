import type { LoginEvent, LoginKind, LoginTarget } from "../../model/types.ts";
import type { Adapter } from "../adapter.ts";
import { timestamp } from "../parseDate.ts";
import { asArray, isRecord, text } from "../read.ts";
import { ipAddress } from "./shared.ts";

// 約 3 万件を読むので、対応表は読み込み時に 1 度だけ作る。キーは小文字にそろえる。
const TARGETS: ReadonlyMap<string, LoginTarget> = new Map([
	["league/tft pc", "lol-tft-pc"],
	["lol", "lol-tft-pc"],
	["tftm", "tft-mobile"],
	["tft", "tft-mobile"],
	["valorant", "valorant"],
	["wild rift", "wildrift"],
	["legends of runeterra", "lor"],
	["riot_client", "riot-account"],
	["rso-prod", "riot-account"],
	["rso-authenticator-prod", "riot-account"],
]);

// この分類は `event_type` の名前から推定したもので、Riot の公式の定義ではない。
// 例えば `Replace` は分類できないので、元の値を残したまま `other` にする。
const KINDS: ReadonlyMap<string, LoginKind> = new Map([
	["login", "login"],
	["connected", "login"],
	["session start", "login"],
	["logout", "logout"],
	["logout user", "logout"],
	["logout deadpool", "logout"],
	["logout kick", "logout"],
	["login kick", "logout"],
	["closed", "logout"],
	["purged", "logout"],
	["expired", "logout"],
	["session expired", "logout"],
	["session kicked out", "logout"],
	["authentication", "auth"],
	["refresh", "auth"],
	["disconnect", "disconnect"],
]);

function target(product: string | null): LoginTarget {
	// 対象が無い記録は、ゲームを持たない Riot アカウント側の認証として扱う
	if (product === null) {
		return "riot-account";
	}
	return TARGETS.get(product.toLowerCase()) ?? "other";
}

function kind(rawType: string): LoginKind {
	return KINDS.get(rawType.toLowerCase()) ?? "other";
}

/** `riotAccount/atlas_login_event_uc.json` */
export const logins: Adapter = (json, context) => {
	const events: LoginEvent[] = [];

	for (const row of asArray(json)) {
		const at = isRecord(row) ? timestamp(row.event_time_utc) : null;
		const rawType = isRecord(row) ? text(row.event_type) : null;
		if (!isRecord(row) || at === null || rawType === null) {
			context.skip();
			continue;
		}

		const rawProduct = text(row.product);
		events.push({
			at,
			target: target(rawProduct),
			rawProduct,
			kind: kind(rawType),
			rawType,
			ip: ipAddress(row.ip_address),
		});
	}

	return { logins: events };
};
