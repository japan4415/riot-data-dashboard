import type {
	AccountEvent,
	AccountEventSource,
	AccountProfile,
} from "../../model/types.ts";
import type { Adapter, AdapterContext, Contribution } from "../adapter.ts";
import { timestamp } from "../parseDate.ts";
import { asArray, isRecord, type JsonRecord, text } from "../read.ts";

const DATE_OF_BIRTH_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** `account_info.json`、`summoner.json`、`clash.json` は 1 件のオブジェクトで、読めた項目だけを返す。 */
function readAccount(
	json: unknown,
	context: AdapterContext,
	read: (record: JsonRecord) => Partial<AccountProfile>,
): Contribution {
	if (!isRecord(json)) {
		context.skip();
		return {};
	}
	// null の項目を含めない。含めると、ほかのファイルで読めた値を null で上書きしてしまう
	return { account: read(json) };
}

/** `riotAccount/account_info.json` */
export const accountInfo: Adapter = (json, context) =>
	readAccount(json, context, (record) => {
		const account: Partial<AccountProfile> = {};

		const gameName = text(record.game_name);
		const tagLine = text(record.tagline);
		if (gameName !== null && tagLine !== null) {
			account.riotId = { gameName, tagLine };
		}

		const username = text(record.username);
		if (username !== null) {
			account.username = username;
		}

		const email = text(record.email);
		if (email !== null) {
			account.email = email;
		}

		const dateOfBirth = text(record.date_of_birth);
		if (dateOfBirth !== null && DATE_OF_BIRTH_PATTERN.test(dateOfBirth)) {
			account.dateOfBirth = dateOfBirth;
		}

		return account;
	});

/** `leagueoflegends/summoner.json` */
export const summoner: Adapter = (json, context) =>
	readAccount(json, context, (record) => {
		const account: Partial<AccountProfile> = {};

		const lolPlatform = text(record.lol_platform);
		if (lolPlatform !== null) {
			account.lolPlatform = lolPlatform;
		}

		// ゲーム名に `#` が含まれる可能性を考え、最後の `#` で分ける
		const riotId = text(record.riot_id);
		const separator = riotId?.lastIndexOf("#") ?? -1;
		if (riotId !== null && separator >= 0) {
			const gameName = riotId.slice(0, separator).trim();
			const tagLine = riotId.slice(separator + 1).trim();
			if (gameName !== "" && tagLine !== "") {
				account.riotId = { gameName, tagLine };
			}
		}

		return account;
	});

/** `leagueoflegends/clash.json` */
export const clash: Adapter = (json, context) =>
	readAccount(json, context, (record) => {
		const account: Partial<AccountProfile> = {};

		const phoneNumber = text(record.phone_number);
		if (phoneNumber !== null) {
			account.phoneNumber = phoneNumber;
		}

		return account;
	});

/** アカウント変更履歴の 1 ファイルを読む。v1 と v2 は種類の項目名と、補足の有無が違う。 */
function readAuditEvents(
	json: unknown,
	context: AdapterContext,
	source: AccountEventSource,
	typeField: string,
): AccountEvent[] {
	const accountEvents: AccountEvent[] = [];

	for (const row of asArray(json)) {
		const at = isRecord(row) ? timestamp(row.event_date) : null;
		const type = isRecord(row) ? text(row[typeField]) : null;
		if (!isRecord(row) || at === null || type === null) {
			context.skip();
			continue;
		}

		accountEvents.push({
			at,
			type,
			// v1 には補足の項目が無い
			description: source === "v2" ? text(row.description) : null,
			source,
		});
	}

	return accountEvents;
}

/** `riotAccount/account_audit_events_v1_uc.json` */
export const accountAuditV1: Adapter = (json, context) => ({
	accountEvents: readAuditEvents(json, context, "v1", "action"),
});

/** `riotAccount/account_audit_events_v2_uc.json` */
export const accountAuditV2: Adapter = (json, context) => ({
	accountEvents: readAuditEvents(json, context, "v2", "event_type"),
});
