import { strToU8, zipSync } from "fflate";

/**
 * 手で合成した開示データ。実在のアカウントの値は含まない。
 *
 * `docs/data-structure.md` に書いた表記ゆれ（日時の書式の混在、文字列の数値、
 * 値なしの表し方の違い、大文字小文字だけが違うフォルダなど）を意図的に含める。
 */
export function syntheticExportFiles(): Record<string, unknown> {
	return {
		"riotAccount/account_info.json": {
			username: "tester",
			game_name: "Tester",
			tagline: "JP1",
			email: "player@example.com",
			date_of_birth: "2000-01-02",
		},
		"riotAccount/account_audit_events_v1_uc.json": [
			{ action: "PASSWORD_CHANGED", event_date: "2014-05-06 07:08:09.0" },
			{ action: "ACCOUNT_STATE_CHANGED", event_date: "2016-05-06 07:08:09" },
		],
		"riotAccount/account_audit_events_v2_uc.json": [
			{
				event_type: "EMAIL",
				description: "delivered",
				event_date: "2021-02-03 04:05:06",
			},
			{
				event_type: "LINKED_IDENTITY_CREATED",
				description: null,
				event_date: "2022-02-03 04:05:06",
			},
		],
		"riotAccount/atlas_login_event_uc.json": [
			{
				event_time_utc: "2024-03-01 09:55:00",
				event_type: "Connected",
				ip_address: "Unknown",
				product: "VALORANT",
			},
			{
				event_time_utc: "2020-01-01 12:00:00",
				event_type: "Login",
				ip_address: "203.0.113.7",
				product: "League/TFT PC",
			},
			{
				event_time_utc: "2023-06-01 20:00:00",
				event_type: "Authentication",
				ip_address: "2001:db8::1",
				product: null,
			},
			{ event_time_utc: "broken", event_type: "Login", product: "TFTm" },
		],
		"leagueoflegends/summoner.json": {
			lol_platform: "JP1",
			riot_id: "Tester#JP1",
		},
		"leagueoflegends/clash.json": { phone_number: "+81******0000" },
		"leagueoflegends/grouped_reports.json": {
			reports_made: { LEAVING_AFK: 2 },
			reports_received: {},
		},
		"leagueoflegends/rp_purchase_history_uc.json": [
			{
				amount: "12.0",
				created: "2013-02-03 04:05:06.0",
				currency_type: "USD",
				payment_type: "paypal",
				store_account_id: 1,
				transaction_id: "NA1-00000000-0000-4000-8000-000000000001",
				transaction_number: "T0001",
				user_ip: "203.0.113.7",
			},
			{
				amount: "1300.00",
				created: "2021-02-03 04:05:06",
				currency_type: "JPY",
				payment_type: "paypal",
				store_account_id: 2,
				transaction_id: "JP1-00000000-0000-4000-8000-000000000002",
				transaction_number: "T0002",
				user_ip: "203.0.113.8",
			},
		],
		"leagueoflegends/store_transactions_uc.json": [
			{
				created: "2021-02-03 04:05:06",
				id: "JP1-00000000-0000-4000-8000-000000000002",
				ip_address: "203.0.113.8",
				ip_balance: 5000,
				ip_delta: 0,
				is_refunded: "0",
				item_id: "rp_1000",
				rp_balance: 1000,
				rp_delta: 1000,
				type: "USER_PURCHASED_RP",
			},
			{
				created: "2013-03-04 05:06:07.0",
				id: "NA1-00000000-0000-4000-8000-000000000003",
				ip_address: "0.0.0.0",
				ip_balance: 200,
				ip_delta: -4800,
				is_refunded: null,
				item_id: "champions_1",
				rp_balance: 0,
				rp_delta: 0,
				type: "PURCHASE",
			},
			{
				created: "2022-03-04 05:06:07",
				id: "JP1-00000000-0000-4000-8000-000000000004",
				ip_address: "203.0.113.8",
				ip_balance: 5000,
				ip_delta: 0,
				is_refunded: "0",
				item_id: "championsskin_1001",
				rp_balance: 25,
				rp_delta: -975,
				type: "PURCHASE",
			},
		],
		"leagueoflegends/chat_logs_v2_uc/successes/100000001.json": {
			chat_logs: {
				in_game: [
					{
						chat: "gl hf",
						riot_id: "Tester#JP1",
						sent_to: "TEAM",
						timestamp: 1_767_322_800_000,
					},
				],
				post_game: [],
				pre_game: [],
			},
			game_id: 100000001,
			match_date_utc: "2026-01-02",
			platform_id: "jp1",
			success: true,
			was_failure: false,
		},
		"leagueoflegends/chat_logs_v2_uc/successes/100000002.json": {
			chat_logs: { in_game: [], post_game: [], pre_game: [] },
			game_id: 100000002,
			match_date_utc: "2026-01-03",
			platform_id: "jp1",
			success: true,
			was_failure: false,
		},
		"teamfighttactics/tft_chat_logs_v2_uc/successes/200000001.json": {
			chat_logs: { in_game: [], post_game: [], pre_game: [] },
			game_id: 200000001,
			match_date_utc: "2026-01-04T05:06:07.123456+00:00",
			match_id: "JP1_200000001",
			platform_id: "jp1",
			product: "tft",
			success: true,
			was_failure: false,
		},
		"teamfighttactics/tft_grouped_reports.json": {
			reports_made: {},
			reports_received: {},
		},
		"valorant/valorant_audio_transcripts_uc.json": [],
		"valorant/valorant_grouped_reports.json": {
			reports_made: {},
			reports_received: {},
		},
		"valorant/valorant_match_history_uc.json": [
			{
				game_end_time_utc: "2024-03-01 10:35:30",
				game_id: "00000000-0000-4000-8000-00000000000a",
				game_mode: "Matchmaking",
				game_outcome: "Win",
				game_start_time_utc: "2024-03-01 10:00:00",
				game_type: "Ranked",
				realm_id: "ap",
			},
			{
				game_end_time_utc: "2024-03-01 09:50:00",
				game_id: "00000000-0000-4000-8000-00000000000b",
				game_mode: "ShootingRange",
				game_outcome: "Loss",
				game_start_time_utc: "2024-03-01 09:40:00",
				game_type: "Not Applicable",
				realm_id: "ap",
			},
			{
				game_end_time_utc: "2023-01-01 10:20:00",
				game_id: "00000000-0000-4000-8000-00000000000c",
				game_mode: "Matchmaking",
				game_outcome: "Loss",
				game_start_time_utc: "2023-01-01 10:00:00",
				game_type: "Hurm",
				realm_id: "ap",
			},
		],
		"valorant/valorant_payment_event_uc.json": [
			{
				country_code: "JPN",
				currency_code: "JPY",
				game_currency_granted: 1000,
				game_currency_type: "VP",
				payment_method: "paypal",
				payment_time_utc: "2024-02-01 00:00:00",
				player_facing_purchase_id: "AB1CDE2FGHIJ",
				real_currency_paid_x100: 120000,
				recipient_id: null,
			},
		],
		"valorant/valorant_purchase_event_uc.json": [
			{
				item_name: "Sample Vandal Level 2\r\n(Variant 1 Red)",
				item_type: "Item",
				purchase_date: "2024-02-01 00:01:02.123",
				spent_currency_amount: 10,
				spent_currency_name: "Radianite Points",
				transaction_id: "00000000-0000-4000-8000-0000000000aa",
				transaction_source: " Gun Upgrade",
				transaction_type: "Purchase",
			},
		],
		"legendsofruneterra/lor_match_history_uc.json": [
			{
				country: "Unknown",
				deck_id: "00000000-0000-4000-8000-0000000000d1",
				faction1: "Demacia",
				faction2: "Unknown",
				faction3: "Unknown",
				game_end_time_utc: "2019-12-01T10:10:00.123456+0000",
				game_id: "00000000-0000-4000-8000-0000000000e1",
				game_mode: "Constructed",
				game_outcome: "Victory",
				game_outcome_reason: "Concession",
				game_start_time_utc: "2019-12-01T10:00:00.123456+0000",
				game_time_seconds: 600,
				game_type: "Ranked",
				is_ai: false,
				order_of_play: 1,
				platform: "Windows",
				play_time_seconds: 600,
				realm_id: "asia",
				total_turn_count: 20,
			},
			{
				country: "Unknown",
				deck_id: "00000000-0000-4000-8000-0000000000d1",
				faction1: "Demacia",
				faction2: "Ionia",
				faction3: "Unknown",
				game_end_time_utc: "2021-12-01T10:05:00.123456+00:00",
				game_id: "00000000-0000-4000-8000-0000000000e2",
				game_mode: "Constructed",
				game_outcome: "Defeat",
				game_outcome_reason: "Zero Health",
				game_start_time_utc: "2021-12-01T10:00:00.123456+00:00",
				game_time_seconds: 300,
				game_type: "AI",
				is_ai: false,
				order_of_play: 0,
				platform: "Android",
				play_time_seconds: 300,
				realm_id: "asia",
				total_turn_count: 12,
			},
		],
		"legendsofruneterra/lor_payment_history_event_uc.json": [
			{
				country_code: "JP",
				currency_code: "JPY",
				game_currency_granted: 500,
				is_prepaid_card: false,
				payment_method: "paypal",
				payment_time_utc: "2020-02-01 00:00:00",
				player_facing_purchase_id: "ZY9XWV8UTSRQ",
				real_currency_paid_x100: 60000,
			},
		],
		"legendsofruneterra/lor_purchase_history_event_uc.json": [
			{
				ip_address: null,
				purchase_time_utc: "2020-02-01T00:01:02.1234567+00:00",
				purchased_item_amount: 1,
				purchased_item_name: "Sample Card",
				purchased_item_new_balance: 1,
				purchased_item_type: "Card",
				realm_id: "asia",
				runtime_platform: "Windows",
				spent_item_amount: 100,
				spent_item_name: "Coins",
				spent_item_new_balance: 400,
				spent_item_type: "Coin",
				transaction_id: "00000000-0000-4000-8000-0000000000f1",
				transaction_source: "DEPRECATED",
			},
		],
		"wildrift/wildrift_currency.json": {
			blue_motes: "1200",
			poro_coins: "30",
			wild_cores: "0",
		},
		"wildrift/wildrift_inventory.json": {
			backpack: [{ name: "XP Boost", quantity: 2 }],
			banners: ["Sample Banner"],
			baubles: ["Sample Bauble"],
			champions: ["Lux", "Garen"],
			emotes: ["Good Job!\n"],
			icon_borders: [],
			skins: [{ champion_name: "Spellthief Lux", skin_name: "Lux" }],
			summoner_icons: ["Sample Icon"],
		},
		"wildrift/wildrift_match_history_uc.json": [
			{
				account_level: 10,
				game_end_time_utc: "2021-05-01 10:20:00",
				game_id: "100000000000000001",
				game_mode: "Summoner's Rift",
				game_outcome: "Victory",
				game_start_time_utc: "2021-05-01 10:00:00",
				game_type: "Ranked",
				player_rank: "Gold III",
			},
			{
				account_level: 1,
				game_end_time_utc: null,
				game_id: "100000000000000002-123456",
				game_mode: "Tutorial 1",
				game_outcome: "Noncompetitive",
				game_start_time_utc: null,
				game_type: "AI",
				player_rank: null,
			},
		],
		"wildrift/wildrift_payment_event_uc.json": [],
		"wildrift/wildrift_purchase_event_uc.json": [
			{
				item_name: "Lux",
				item_type: "Champion",
				purchase_date: "2021-05-02 00:00:00",
				spent_currency_amount: 5500,
				spent_currency_name: "Blue Motes",
				transaction_id: null,
				transaction_source: "Store",
				transaction_type: "Purchase",
			},
		],
		"penalties/penalty_history.json": [
			{
				date_issued: "2018-01-02T03:04:05Z",
				is_manual: false,
				restriction_reason: "SAMPLE_REASON",
				restriction_type: "CHAT_RESTRICTION",
				scope: "LEAGUE_OF_LEGENDS",
				sentence: "TIMEOUT",
				status: "LAPSED",
			},
		],
		"zendesk/zendesk_tickets.json": {
			"10000001": {
				comments: [
					{
						author: "Player",
						comment: "ログインできません。\n確認をお願いします。",
						create_datetime: "2022-03-04 05:06:07",
					},
					{
						author: "Agent",
						comment: "確認しました。",
						create_datetime: "2022-03-05 05:06:07",
					},
				],
				create_datetime: "2022-03-04 05:06:07",
				status: "closed",
				subject: "ログインについて",
				ticket_id: "10000001",
			},
		},
		// 大文字小文字だけが違うフォルダが両方入っている
		"2XKO/2xko_game_match_history_uc.json": [],
		"2xko/2xko_audio_transcripts_uc.json": [],
		"alphi/alphi_chat.json": [],
		"league/league_audio_transcripts_uc.json": [],
	};
}

export interface SyntheticZipOptions {
	/** 追加または上書きするファイル。値が文字列ならそのまま、それ以外は JSON にして入れる。 */
	extra?: Record<string, unknown>;
	/** 取り除くファイルのパス。 */
	omit?: readonly string[];
	/** 全体を包むフォルダ。展開したフォルダを圧縮し直した zip を再現する。 */
	wrapper?: string;
}

/** 合成した開示データの zip を作る。 */
export function buildSyntheticZip(
	options: SyntheticZipOptions = {},
): Uint8Array {
	const files: Record<string, unknown> = {
		...syntheticExportFiles(),
		"readme.csv": "text\nREADME - Additional Information",
		...options.extra,
	};
	for (const path of options.omit ?? []) {
		delete files[path];
	}

	const prefix = options.wrapper ? `${options.wrapper}/` : "";
	const entries: Record<string, Uint8Array> = {};
	for (const [path, content] of Object.entries(files)) {
		entries[prefix + path] = strToU8(
			typeof content === "string" ? content : JSON.stringify(content),
		);
	}
	return zipSync(entries);
}
