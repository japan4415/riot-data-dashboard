import { strToU8, zipSync } from "fflate";

/**
 * 数年分の合成データ。自分の開示データが手元に無い人が画面を試すためと、
 * 開発中に見た目を確かめるために使う。
 *
 * 実在のアカウントの値は含まない。乱数の種を固定しているので、毎回同じ内容になる。
 * 夜と週末に活動が寄る、ゲームごとに遊んだ時期が違う、といった偏りを持たせてある。
 * 開示データと同じ形の zip を作り、利用者のファイルと同じ経路で読み込ませる。
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

/**
 * その日のログインに記録する IP アドレス。文書用に予約されたアドレスだけを使う。
 * 月が変わるとアドレスも変わり、モバイル回線（`mobile`）では IPv6 にする。
 */
function demoIp(day: number, mobile = false): string {
	const month = Math.floor(day / (30 * DAY_MS));
	return mobile
		? `2001:db8::${(month % 60).toString(16)}`
		: `203.0.113.${1 + (month % 48)}`;
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

const RANKS = [
	"Iron II",
	"Iron I",
	"Bronze III",
	"Bronze I",
	"Silver III",
	"Silver I",
	"Gold IV",
	"Gold III",
	"Gold II",
	"Platinum IV",
];

/** 重みに応じて 1 つ選ぶ。 */
function pick<T>(
	random: () => number,
	options: ReadonlyArray<readonly [T, number]>,
): T {
	const total = options.reduce((sum, [, weight]) => sum + weight, 0);
	let roll = random() * total;
	for (const [value, weight] of options) {
		roll -= weight;
		if (roll < 0) {
			return value;
		}
	}
	return (options.at(-1) as readonly [T, number])[0];
}

type Row = Record<string, unknown>;

/** VALORANT の試合の一部を、ランクと通常以外の種別に変える。 */
function varyValorantMatches(matches: Row[], random: () => number) {
	for (const match of matches) {
		if (match.game_mode !== "Matchmaking") {
			continue;
		}
		const type = pick(random, [
			[null, 76],
			["Deathmatch", 8],
			["Spike Rush", 6],
			["Hurm", 4],
			["Swiftplay", 3],
			["Ggteam", 1],
			["Custom Game", 2],
		] as const);
		if (type === null) {
			continue;
		}
		if (type === "Custom Game") {
			match.game_mode = type;
			match.game_type = "Not Applicable";
			continue;
		}
		match.game_type = type;
		if (type === "Deathmatch") {
			// 元データでは、ほぼすべて負けとして記録されている
			match.game_outcome = "Loss";
		}
	}
}

const LOR_DECKS: ReadonlyArray<readonly [readonly [string, string], number]> = [
	[["Demacia", "Ionia"], 46],
	[["Noxus", "Piltover & Zaun"], 20],
	[["Shadow Isles", "Freljord"], 14],
	[["Bilgewater", "Unknown"], 8],
	[["Targon", "Demacia"], 7],
	[["Unknown", "Unknown"], 3],
];

/** LoR の試合に、地域、ターン数、決着の理由のばらつきを持たせる。 */
function varyLorMatches(matches: Row[], random: () => number) {
	for (const match of matches) {
		const [faction1, faction2] = pick(random, LOR_DECKS);
		match.faction1 = faction1;
		match.faction2 = faction2;
		const won = match.game_outcome === "Victory";
		match.game_outcome_reason = pick(random, [
			["Concession", won ? 58 : 46],
			["Zero Health", won ? 41 : 52],
			["Disconnect", 1],
		] as const);
		// 降参で終わった試合は、短くなりやすい
		const early = match.game_outcome_reason === "Concession" ? 4 : 10;
		match.total_turn_count = early + Math.floor(random() * 14 + random() * 14);
		const kind = pick(random, [
			["Ranked", 70],
			["Normal", 20],
			["AI", 10],
		] as const);
		match.game_type = kind;
		match.platform = random() < 0.65 ? "Android" : "Windows";
		match.order_of_play = random() < 0.5 ? 0 : 1;
	}
}

/** Wild Rift の試合に、通常戦と練習を混ぜ、ランクを上下させる。 */
function varyWildRiftMatches(matches: Row[], random: () => number) {
	let step = 0;
	for (const [index, match] of matches.entries()) {
		// 勝つと上がりやすく、負けると下がりやすい。全体としては少しずつ上がる
		const won = match.game_outcome === "Victory";
		if (index % 3 === 2) {
			step += won ? 1 : random() < 0.45 ? -1 : 0;
		}
		step = Math.max(0, Math.min(RANKS.length - 1, step));
		match.player_rank = RANKS[step];
		if (random() < 0.1) {
			match.game_type = "Normal";
		}
	}
	matches.unshift(
		{
			account_level: 1,
			game_end_time_utc: null,
			game_id: "100000000000009001-1",
			game_mode: "Tutorial 1",
			game_outcome: "Noncompetitive",
			game_start_time_utc: null,
			game_type: "AI",
			player_rank: null,
		},
		{
			account_level: 2,
			game_end_time_utc: "2020-10-10 11:15:00",
			game_id: "100000000000009002",
			game_mode: "Summoner's Rift",
			game_outcome: "Noncompetitive",
			game_start_time_utc: "2020-10-10 11:00:00",
			game_type: "Co-op vs. AI",
			player_rank: null,
		},
	);
}

/**
 * サンプルに出すチャンピオンの数値 ID（アニー、アッシュ、ラックスなど）。
 * 品目 ID は、チャンピオンが `champions_<ID>`、スキンが `championsskin_<ID × 1000 + 番号>`。
 */
const DEMO_CHAMPIONS = [1, 21, 22, 51, 64, 81, 86, 99, 103, 157, 222, 236];

const SKIN_PRICES = [520, 750, 975, 1350, 1820];
const CHAMPION_PRICES = [450, 1350, 3150, 4800, 6300];

/** LoL のストアの取引。RP とブルーエッセンスの残高を追いながら作る。 */
function lolStoreTransactions(random: () => number): Row[] {
	const rows: Row[] = [];
	let rp = 0;
	let be = 1200;
	let serial = 0;
	const add = (at: number, type: string, itemId: string, fields: Row = {}) => {
		serial += 1;
		rp += Number(fields.rp_delta ?? 0);
		be += Number(fields.ip_delta ?? 0);
		rows.push({
			created: stamp(at),
			id: `JP1-00000000-0000-4000-8000-${String(serial).padStart(12, "0")}`,
			ip_address: "203.0.113.7",
			ip_balance: be,
			ip_delta: 0,
			is_refunded: "0",
			item_id: itemId,
			rp_balance: rp,
			rp_delta: 0,
			type,
			...fields,
		});
	};

	const championId = () =>
		DEMO_CHAMPIONS[Math.floor(random() * DEMO_CHAMPIONS.length)] ?? 1;
	// 好きなチャンピオンのスキンを多く買う、という偏りを持たせる
	const skinItem = () => {
		const champion = random() < 0.35 ? 99 : championId();
		return `championsskin_${champion * 1000 + 1 + Math.floor(random() * 4)}`;
	};

	const start = Date.parse("2016-02-01");
	const end = Date.parse("2026-10-01");
	for (let month = start; month < end; month += 30 * DAY_MS) {
		// 遊んだ分だけ、ブルーエッセンスが増えている
		be += 600 + Math.floor(random() * 2400);
		let at = month + Math.floor(random() * 20) * DAY_MS + 11 * 3_600_000;

		if (random() < 0.3) {
			add(at, "USER_PURCHASED_RP", "rp_1380", { rp_delta: 1380 });
			at += 120_000;
		}
		const purchases = Math.floor(random() * 4);
		for (let n = 0; n < purchases; n += 1) {
			at += 60_000 + Math.floor(random() * 3 * DAY_MS);
			const skinPrice =
				SKIN_PRICES[Math.floor(random() * SKIN_PRICES.length)] ?? 975;
			const championPrice =
				CHAMPION_PRICES[Math.floor(random() * CHAMPION_PRICES.length)] ?? 4800;
			const roll = random();
			if (roll < 0.3 && rp >= skinPrice) {
				add(at, "PURCHASE", skinItem(), {
					rp_delta: -skinPrice,
				});
			} else if (roll < 0.55 && be >= championPrice) {
				add(at, "PURCHASE", `champions_${championId()}`, {
					ip_delta: -championPrice,
				});
			} else if (roll < 0.8) {
				add(at, "PURCHASE", `hextech_crafting_${serial}`);
				add(at, "PURCHASE", `summoner_icon_${serial}`);
			} else if (roll < 0.9) {
				add(at, "PURCHASE", `emote_${serial}`);
			} else {
				add(at, "PURCHASE", `wardskin_${serial}`);
			}
		}
		if (random() < 0.05 && rp >= 975) {
			const itemId = skinItem();
			add(at + DAY_MS, "PURCHASED_GIFT", itemId, { rp_delta: -975 });
			add(at + DAY_MS, "ITEM_TRANSFER_SENT", itemId);
		}
		if (random() < 0.03) {
			add(at + 2 * DAY_MS, "ITEM_TRANSFER_RECEIVED", skinItem());
		}
		if (random() < 0.02) {
			add(at + 3 * DAY_MS, "REFUND", skinItem(), {
				rp_delta: 975,
				is_refunded: "1",
			});
		}
	}
	return rows;
}

const VALORANT_ITEMS = [
	["Sample Vandal", "Item", "Rotation", "VALORANT Points", 1775],
	["Sample Phantom Level 2", "Item", "Gun Upgrade", "Radianite Points", 10],
	[
		"Sample Operator\r\n(Variant 1 Blue)",
		"Item",
		"Item Variant Upgrade",
		"Radianite Points",
		15,
	],
	["Sample Bundle", "Bundle", "Bundle", "VALORANT Points", 7100],
	[
		"Sample Battle Pass",
		"BP Bundle",
		"Act2 Battle Pass Unlock",
		"VALORANT Points",
		1000,
	],
	[
		"Sample Agent",
		"Char Bundle",
		"Agent Store",
		"Character Recruitment Token",
		1,
	],
] as const;

function valorantPurchases(random: () => number): Row[] {
	const rows: Row[] = [];
	for (let n = 0; n < 34; n += 1) {
		const [name, type, source, currency, amount] = pick(
			random,
			VALORANT_ITEMS.map((item) => [item, 1] as const),
		);
		const at = Date.parse("2020-07-01") + Math.floor(random() * 2200) * DAY_MS;
		rows.push({
			item_name: name,
			item_type: type,
			purchase_date: `${stamp(at)}.000`,
			spent_currency_amount: amount,
			spent_currency_name: currency,
			transaction_id: `00000000-0000-4000-8000-${String(900000 + n).padStart(12, "0")}`,
			// 元データには、先頭に空白が付いた値がある
			transaction_source: n % 5 === 0 ? ` ${source}` : source,
			transaction_type: "Purchase",
		});
	}
	return rows;
}

function lorPurchases(random: () => number): Row[] {
	const rows: Row[] = [];
	let coins = 3000;
	for (let n = 0; n < 40; n += 1) {
		const at = Date.parse("2020-01-10") + Math.floor(random() * 500) * DAY_MS;
		const withCoins = random() < 0.4;
		if (withCoins) {
			coins = Math.max(0, coins - 100);
		}
		rows.push({
			ip_address: null,
			purchase_time_utc: `${new Date(at).toISOString().slice(0, 19)}.0000000+00:00`,
			purchased_item_amount: 1 + Math.floor(random() * 3),
			purchased_item_name: `Sample Card ${1 + (n % 12)}`,
			purchased_item_new_balance: 1 + Math.floor(random() * 3),
			purchased_item_type: "Card",
			realm_id: "asia",
			runtime_platform: "Windows",
			spent_item_amount: withCoins ? 100 : 1,
			spent_item_name: withCoins ? "Coins" : "Rare Wildcard",
			spent_item_new_balance: withCoins ? coins : 2,
			spent_item_type: withCoins ? "Coin" : "Wildcard",
			transaction_id: `00000000-0000-4000-8000-${String(800000 + n).padStart(12, "0")}`,
			transaction_source: "DEPRECATED",
		});
	}
	return rows;
}

/** 現金での支払い。初めは米ドル、途中から日本円で払った、という設定にする。 */
function lolPayments(random: () => number): Row[] {
	const rows: Row[] = [];
	const usd = ["5.0", "10.0", "20.0", "35.00"];
	const jpy = ["650", "1300.00", "2600", "5200.00"];
	for (let year = 2016; year <= 2026; year += 1) {
		const times = 1 + Math.floor(random() * 3);
		for (let n = 0; n < times; n += 1) {
			const at =
				Date.parse(`${year}-01-05`) + Math.floor(random() * 290) * DAY_MS;
			const dollars = year < 2019;
			const amounts = dollars ? usd : jpy;
			rows.push({
				amount: amounts[Math.floor(random() * amounts.length)],
				created: stamp(at + 11 * 3_600_000),
				currency_type: dollars ? "USD" : "JPY",
				payment_type: dollars ? "paypal" : "SB_CreditCard",
				store_account_id: dollars ? 1 : 2,
				transaction_id: `JP1-00000000-0000-4000-8000-${String(700000 + rows.length).padStart(12, "0")}`,
				transaction_number: `DEMO${String(rows.length).padStart(4, "0")}`,
				user_ip: demoIp(at),
			});
		}
	}
	return rows;
}

const AUDIT_V1 = [
	["ACCOUNT_STATE_CHANGED", "2016-01-03 02:10:00.0"],
	["EMAIL_VALIDATION_REQUESTED", "2016-01-03 02:11:00.0"],
	["SEND_VALIDATION_EMAIL", "2016-01-03 02:11:05"],
	["PASSWORD_CHANGED", "2016-09-12 13:20:00"],
	["PASSWORD_CHANGED", "2017-04-02 10:00:00"],
	["EXCESSIVE_CHAT_TOXICITY", "2017-08-20 15:30:00"],
	["PASSWORD_CHANGED", "2018-03-15 22:45:00"],
] as const;

const AUDIT_V2 = [
	["EMAIL", "delivered", "2019-02-01 09:00:00"],
	["USER_FIELD_CHANGED", "username", "2019-06-10 12:00:00"],
	["FEDERATED_IDENTITY_CREATED", null, "2020-06-02 08:00:00"],
	["LINKED_IDENTITY_CREATED", null, "2020-06-02 08:00:05"],
	["IDENTITY_LINK_SUCCESS", null, "2020-06-02 08:00:10"],
	["EMAIL", "delivered", "2021-11-20 03:00:00"],
	["USER_FIELD_CHANGED", "email", "2022-05-05 05:00:00"],
	["ANOMALOUS_ACTIVITY", null, "2023-09-09 18:00:00"],
	["EMAIL", "delivered", "2023-09-09 18:01:00"],
	["USER_FIELD_CHANGED", "password", "2023-09-09 18:30:00"],
	["EMAIL", "delivered", "2026-03-01 01:00:00"],
] as const;

/** チャットログ。発言が無い試合のほうが多い。 */
function chatLogFiles(): Record<string, unknown> {
	const files: Record<string, unknown> = {};
	const lines = [
		["gl hf", "TEAM", "pre_game"],
		["nice", "TEAM", "in_game"],
		["bot に寄ります", "PARTY_1", "in_game"],
		["gg wp", "TEAM", "post_game"],
	] as const;
	for (let n = 0; n < 12; n += 1) {
		const gameId = 500000001 + n;
		const day = `2026-${n < 6 ? "09" : "10"}-${String(2 + n * 2).padStart(2, "0")}`;
		const logs: Record<string, unknown[]> = {
			pre_game: [],
			in_game: [],
			post_game: [],
		};
		// 3 試合に 1 回だけ発言がある
		if (n % 3 === 0) {
			lines
				.slice(0, n === 0 ? 4 : 2)
				.forEach(([chat, sentTo, phase], index) => {
					logs[phase]?.push({
						chat,
						riot_id: "Demo#0000",
						sent_to: sentTo,
						timestamp: Date.parse(`${day}T11:00:00Z`) + index * 240_000,
					});
				});
		}
		files[`leagueoflegends/chat_logs_v2_uc/successes/${gameId}.json`] = {
			chat_logs: logs,
			game_id: gameId,
			match_date_utc: day,
			platform_id: "jp1",
			success: true,
			was_failure: false,
		};
	}
	files["teamfighttactics/tft_chat_logs_v2_uc/successes/600000001.json"] = {
		chat_logs: {
			in_game: [
				{
					chat: "おつかれさまでした",
					riot_id: "Demo#0000",
					sent_to: "TEAM",
					timestamp: Date.parse("2026-10-20T12:30:00Z"),
				},
			],
			post_game: [],
			pre_game: [],
		},
		game_id: 600000001,
		match_date_utc: "2026-10-20T12:05:00.000000+00:00",
		match_id: "JP1_600000001",
		platform_id: "jp1",
		product: "tft",
		success: true,
		was_failure: false,
	};
	return files;
}

const WILD_RIFT_CHAMPIONS = [
	"Ahri",
	"Ashe",
	"Braum",
	"Garen",
	"Jinx",
	"Lux",
	"Nasus",
	"Sona",
	"Vi",
	"Yasuo",
];

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
					ip_address: demoIp(day),
					product: "League/TFT PC",
				});
				at += (30 + random() * 60) * 60_000;
				logins.push({
					event_time_utc: stamp(at),
					event_type: "Logout User",
					ip_address: demoIp(day),
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
				ip_address: demoIp(day, true),
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
				ip_address: demoIp(day),
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
				ip_address: demoIp(day, true),
				product: "TFTm",
			});
		}
	}

	// ここから先は別の乱数列を使い、上で作った日ごとの活動を変えない
	const detail = createRandom(seed + 1);
	varyValorantMatches(valorantMatches as Row[], detail);
	varyLorMatches(lorMatches as Row[], detail);
	varyWildRiftMatches(wildriftMatches as Row[], detail);

	return {
		"riotAccount/account_info.json": {
			username: "demo",
			game_name: "Demo",
			tagline: "0000",
			email: "demo@example.com",
			date_of_birth: "2000-01-01",
		},
		"riotAccount/account_audit_events_v1_uc.json": AUDIT_V1.map(
			([action, eventDate]) => ({ action, event_date: eventDate }),
		),
		"riotAccount/account_audit_events_v2_uc.json": AUDIT_V2.map(
			([eventType, description, eventDate]) => ({
				event_type: eventType,
				description,
				event_date: eventDate,
			}),
		),
		"leagueoflegends/summoner.json": {
			lol_platform: "JP1",
			riot_id: "Demo#0000",
		},
		"leagueoflegends/clash.json": { phone_number: "+81******0000" },
		"leagueoflegends/grouped_reports.json": {
			reports_made: { LEAVING_AFK: 7, ASSISTING_ENEMY_TEAM: 2 },
			reports_received: { LEAVING_AFK: 1 },
		},
		"valorant/valorant_grouped_reports.json": {
			reports_made: { LEAVING_AFK: 3 },
			reports_received: {},
		},
		"penalties/penalty_history.json": [
			{
				date_issued: "2017-08-20T15:30:00Z",
				is_manual: false,
				restriction_reason: "DISRUPTIVE_COMMUNICATION",
				restriction_type: "CHAT_RESTRICTION",
				scope: "LEAGUE_OF_LEGENDS",
				sentence: "TIMEOUT",
				status: "LAPSED",
			},
			{
				date_issued: "2019-03-02T09:00:00Z",
				is_manual: true,
				restriction_reason: "DISRUPTIVE_COMMUNICATION",
				restriction_type: "SUSPENSION",
				scope: "LEAGUE_OF_LEGENDS",
				sentence: "TIMEOUT",
				status: "LAPSED",
			},
		],
		"zendesk/zendesk_tickets.json": {
			"90000001": {
				comments: [
					{
						author: "Player",
						comment:
							"購入した RP が反映されていません。\n\n決済は完了しているようです。確認をお願いします。",
						create_datetime: "2019-06-10 11:00:00",
					},
					{
						author: "Agent",
						comment:
							"お問い合わせありがとうございます。\n購入の記録を確認し、RP を付与しました。ゲームを再起動してご確認ください。",
						create_datetime: "2019-06-11 02:30:00",
					},
					{
						author: "Player",
						comment: "反映されました。ありがとうございました。",
						create_datetime: "2019-06-11 09:15:00",
					},
				],
				create_datetime: "2019-06-10 11:00:00",
				status: "closed",
				subject: "購入した RP が反映されない",
				ticket_id: "90000001",
			},
			"90000002": {
				comments: [
					{
						author: "Player",
						comment: "アカウントのデータの開示をお願いします。",
						create_datetime: "2026-10-01 04:00:00",
					},
				],
				create_datetime: "2026-10-01 04:00:00",
				status: "open",
				subject: "データの開示について",
				ticket_id: "90000002",
			},
		},
		...chatLogFiles(),
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
		"leagueoflegends/rp_purchase_history_uc.json": lolPayments(detail),
		"legendsofruneterra/lor_payment_history_event_uc.json": [
			{
				country_code: "JP",
				currency_code: "JPY",
				game_currency_granted: 1090,
				is_prepaid_card: false,
				payment_method: "paypal",
				payment_time_utc: "2020-02-11 10:00:00",
				player_facing_purchase_id: "DEMO00000003",
				real_currency_paid_x100: 120000,
			},
		],
		"leagueoflegends/store_transactions_uc.json": lolStoreTransactions(detail),
		"valorant/valorant_purchase_event_uc.json": valorantPurchases(detail),
		"wildrift/wildrift_match_history_uc.json": wildriftMatches,
		"wildrift/wildrift_currency.json": {
			blue_motes: "8450",
			poro_coins: "120",
			wild_cores: "0",
		},
		"wildrift/wildrift_inventory.json": {
			backpack: [
				{ name: "XP Boost", quantity: 3 },
				{ name: "Sample Chest", quantity: 1 },
			],
			banners: ["Sample Banner"],
			baubles: ["Sample Bauble 1", "Sample Bauble 2"],
			champions: WILD_RIFT_CHAMPIONS,
			emotes: ["Good Job!\n", "Sample Emote"],
			icon_borders: ["Sample Border"],
			// 元データでは、2 つの項目の中身が入れ替わっている
			skins: [
				{ champion_name: "Spellthief Lux", skin_name: "Lux" },
				{ champion_name: "Foxfire Ahri", skin_name: "Ahri" },
				{ champion_name: "Sample Skin Jinx", skin_name: "Jinx" },
			],
			summoner_icons: ["Sample Icon 1", "Sample Icon 2", "Sample Icon 3"],
		},
		"wildrift/wildrift_purchase_event_uc.json": WILD_RIFT_CHAMPIONS.slice(
			0,
			6,
		).map((name, index) => ({
			item_name: name,
			item_type: "Champion",
			purchase_date: stamp(Date.parse("2020-11-01") + index * 40 * DAY_MS),
			spent_currency_amount: 5500,
			spent_currency_name: "Blue Motes",
			transaction_id: null,
			transaction_source: index % 2 === 0 ? "Store" : "Collection",
			transaction_type: "Purchase",
		})),
		"legendsofruneterra/lor_match_history_uc.json": lorMatches,
		"legendsofruneterra/lor_purchase_history_event_uc.json":
			lorPurchases(detail),
	};
}

export function buildDemoZip(seed?: number): Uint8Array {
	const entries: Record<string, Uint8Array> = {};
	for (const [path, content] of Object.entries(demoExportFiles(seed))) {
		entries[path] = strToU8(JSON.stringify(content));
	}
	return zipSync(entries);
}
