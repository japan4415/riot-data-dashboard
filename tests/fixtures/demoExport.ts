import { strToU8, zipSync } from "fflate";

/**
 * 画面の見た目を確かめるための、数年分の合成データ。
 *
 * 実在のアカウントの値は含まない。乱数の種を固定しているので、毎回同じ内容になる。
 * 夜と週末に活動が寄る、ゲームごとに遊んだ時期が違う、といった偏りを持たせてある。
 */

/** 種を固定した乱数（mulberry32）。 */
function createRandom(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
	};
}

const DAY_MS = 86_400_000;

function stamp(ms: number): string {
	return new Date(ms).toISOString().slice(0, 19).replace("T", " ");
}

interface Era {
	from: string;
	to: string;
	/** 平日に遊ぶ確率。週末はこれより高くなる。 */
	chance: number;
}

function activeChance(eras: readonly Era[], day: number, weekend: boolean) {
	for (const era of eras) {
		if (day >= Date.parse(era.from) && day < Date.parse(era.to)) {
			return Math.min(0.95, era.chance * (weekend ? 1.8 : 1));
		}
	}
	return 0;
}

/** 日本時間の夜に寄せた、その日の開始時刻（UTC のミリ秒）。 */
function eveningStart(day: number, random: () => number, weekend: boolean) {
	// 日本時間 19〜25 時が中心。週末は昼からも遊ぶ
	const hourJst =
		weekend && random() < 0.35 ? 11 + random() * 7 : 19 + random() * 6;
	return day + (hourJst - 9) * 3_600_000 + Math.floor(random() * 3_600_000);
}

const LOL: Era[] = [
	{ from: "2016-01-01", to: "2019-01-01", chance: 0.3 },
	{ from: "2019-01-01", to: "2021-01-01", chance: 0.42 },
	{ from: "2021-01-01", to: "2024-01-01", chance: 0.2 },
	{ from: "2024-01-01", to: "2026-11-01", chance: 0.1 },
];
const VALORANT: Era[] = [
	{ from: "2020-06-02", to: "2021-06-01", chance: 0.5 },
	{ from: "2021-06-01", to: "2024-06-01", chance: 0.28 },
	{ from: "2024-06-01", to: "2026-10-01", chance: 0.07 },
];
const WILD_RIFT: Era[] = [
	{ from: "2020-10-10", to: "2022-06-01", chance: 0.12 },
];
const LOR: Era[] = [
	{ from: "2019-11-18", to: "2020-06-01", chance: 0.1 },
	{ from: "2021-03-01", to: "2021-09-01", chance: 0.14 },
];
const TFT_MOBILE: Era[] = [
	{ from: "2021-01-01", to: "2026-11-01", chance: 0.06 },
];

const RANKS = ["Iron II", "Bronze III", "Silver I", "Gold IV", "Gold II"];

export function demoExportFiles(seed = 20261122): Record<string, unknown> {
	const random = createRandom(seed);
	const logins: unknown[] = [];
	const valorantMatches: unknown[] = [];
	const wildriftMatches: unknown[] = [];
	const lorMatches: unknown[] = [];
	let serial = 0;
	const id = () => {
		serial += 1;
		return `00000000-0000-4000-8000-${String(serial).padStart(12, "0")}`;
	};

	const start = Date.parse("2016-01-01");
	const end = Date.parse("2026-11-01");
	for (let day = start; day < end; day += DAY_MS) {
		const weekday = new Date(day).getUTCDay();
		const weekend = weekday === 0 || weekday === 6;

		if (random() < activeChance(LOL, day, weekend)) {
			const sessions = 1 + Math.floor(random() * 3);
			let at = eveningStart(day, random, weekend);
			for (let n = 0; n < sessions; n += 1) {
				logins.push({
					event_time_utc: stamp(at),
					event_type: "Login",
					ip_address: "203.0.113.7",
					product: "League/TFT PC",
				});
				at += (30 + random() * 60) * 60_000;
				logins.push({
					event_time_utc: stamp(at),
					event_type: "Logout User",
					ip_address: "203.0.113.7",
					product: "League/TFT PC",
				});
				at += 5 * 60_000;
			}
		}

		if (random() < activeChance(VALORANT, day, weekend)) {
			let at = eveningStart(day, random, weekend);
			logins.push({
				event_time_utc: stamp(at),
				event_type: "Connected",
				ip_address: "Unknown",
				product: "VALORANT",
			});
			if (random() < 0.4) {
				valorantMatches.push({
					game_id: id(),
					game_start_time_utc: stamp(at),
					game_end_time_utc: stamp(at + 8 * 60_000),
					game_mode: "ShootingRange",
					game_type: "Not Applicable",
					game_outcome: "Loss",
					realm_id: "ap",
				});
				at += 9 * 60_000;
			}
			const games = 1 + Math.floor(random() * 4);
			for (let n = 0; n < games; n += 1) {
				const length = (25 + random() * 20) * 60_000;
				valorantMatches.push({
					game_id: id(),
					game_start_time_utc: stamp(at),
					game_end_time_utc: stamp(at + length),
					game_mode: "Matchmaking",
					game_type: random() < 0.6 ? "Ranked" : "Unrated",
					game_outcome: random() < 0.51 ? "Win" : "Loss",
					realm_id: "ap",
				});
				at += length + 4 * 60_000;
			}
			logins.push({
				event_time_utc: stamp(at),
				event_type: "Closed",
				ip_address: null,
				product: "VALORANT",
			});
		}

		if (random() < activeChance(WILD_RIFT, day, weekend)) {
			const at = eveningStart(day, random, weekend);
			const progress = (day - Date.parse("2020-10-10")) / (600 * DAY_MS);
			logins.push({
				event_time_utc: stamp(at),
				event_type: "Login",
				ip_address: "203.0.113.9",
				product: "Wild Rift",
			});
			wildriftMatches.push({
				account_level: Math.min(40, 1 + Math.floor(progress * 40)),
				game_end_time_utc: stamp(at + 18 * 60_000),
				game_id: String(100000000000000000 + wildriftMatches.length),
				game_mode: "Summoner's Rift",
				game_outcome: random() < 0.55 ? "Victory" : "Defeat",
				game_start_time_utc: stamp(at),
				game_type: "Ranked",
				player_rank:
					RANKS[
						Math.min(RANKS.length - 1, Math.floor(progress * RANKS.length))
					],
			});
		}

		if (random() < activeChance(LOR, day, weekend)) {
			const at = eveningStart(day, random, weekend);
			const length = 300 + Math.floor(random() * 500);
			logins.push({
				event_time_utc: stamp(at),
				event_type: "Session Start",
				ip_address: "203.0.113.7",
				product: "Legends of Runeterra",
			});
			lorMatches.push({
				country: "Unknown",
				deck_id: "00000000-0000-4000-8000-0000000000d1",
				faction1: "Demacia",
				faction2: "Ionia",
				faction3: "Unknown",
				game_end_time_utc: `${new Date(at + length * 1000).toISOString().slice(0, 19)}.000000+00:00`,
				game_id: id(),
				game_mode: "Constructed",
				game_outcome: random() < 0.6 ? "Victory" : "Defeat",
				game_outcome_reason: "Zero Health",
				game_start_time_utc: `${new Date(at).toISOString().slice(0, 19)}.000000+00:00`,
				game_time_seconds: length,
				game_type: "Ranked",
				is_ai: false,
				order_of_play: 0,
				platform: "Windows",
				play_time_seconds: length,
				realm_id: "asia",
				total_turn_count: 20,
			});
		}

		if (random() < activeChance(TFT_MOBILE, day, weekend)) {
			logins.push({
				event_time_utc: stamp(eveningStart(day, random, weekend)),
				event_type: "Login",
				ip_address: "203.0.113.9",
				product: "TFTm",
			});
		}
	}

	return {
		"riotAccount/account_info.json": {
			username: "demo",
			game_name: "Demo",
			tagline: "0000",
			email: "demo@example.com",
			date_of_birth: "2000-01-01",
		},
		"riotAccount/atlas_login_event_uc.json": logins,
		"valorant/valorant_match_history_uc.json": valorantMatches,
		"valorant/valorant_payment_event_uc.json": [
			{
				country_code: "JP",
				currency_code: "JPY",
				game_currency_granted: 4400,
				game_currency_type: "VP",
				payment_method: "paypal",
				payment_time_utc: "2020-07-01 12:00:00",
				player_facing_purchase_id: "DEMO00000001",
				real_currency_paid_x100: 490000,
				recipient_id: null,
			},
			{
				country_code: "JP",
				currency_code: "JPY",
				game_currency_granted: 10500,
				game_currency_type: "VP",
				payment_method: "paypal",
				payment_time_utc: "2022-03-01 12:00:00",
				player_facing_purchase_id: "DEMO00000002",
				real_currency_paid_x100: 1100000,
				recipient_id: null,
			},
		],
		"leagueoflegends/rp_purchase_history_uc.json": [
			{
				amount: "20.0",
				created: "2017-05-01 12:00:00",
				currency_type: "USD",
				payment_type: "paypal",
				store_account_id: 1,
				transaction_id: "NA1-00000000-0000-4000-8000-0000000000a1",
				transaction_number: "DEMO0001",
				user_ip: "203.0.113.7",
			},
		],
		"wildrift/wildrift_match_history_uc.json": wildriftMatches,
		"legendsofruneterra/lor_match_history_uc.json": lorMatches,
	};
}

export function buildDemoZip(seed?: number): Uint8Array {
	const entries: Record<string, Uint8Array> = {};
	for (const [path, content] of Object.entries(demoExportFiles(seed))) {
		entries[path] = strToU8(JSON.stringify(content));
	}
	return zipSync(entries);
}
