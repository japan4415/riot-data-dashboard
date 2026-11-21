# Riot データ開示 zip の構造

Riot Games にデータ開示を請求すると届く zip ファイルの構造をまとめる。
アプリケーションがこの zip を読み込むときの前提資料である。

## この文書の前提

- 2026 年 11 月に取得した **1 アカウント分の zip だけ** を調べた結果である。他のアカウントでは、ここに無いファイルや値が現れる可能性がある。
- 「観測した値」は、そのサンプルに現れた値の一覧であり、取りうる値の全部ではない。
- 個人を特定できる値（IP アドレス、メールアドレス、ID、チャット本文など）は載せていない。
- ペナルティ、通報、決済手段は、観測した値の種類だけを載せる。件数、日時、どの値がどの記録に付いていたかは載せていない。
- 項目の意味は項目名と値から読み取ったものであり、Riot による公式の説明ではない。推測を含む箇所は「未確認」と明記する。

## zip コンテナ

| 項目 | 内容 |
|---|---|
| ファイル名 | `<ゲーム名>-<タグライン>.zip`（Riot ID をハイフンでつないだ形） |
| 大きさ | 圧縮時 約 0.5MB、展開後 約 7MB |
| エントリ数 | 55（JSON 54、CSV 1） |
| 圧縮方式 | すべて Deflate。暗号化なし |
| フォルダ構成 | 全体を包む最上位フォルダは無い。ゲームごとのフォルダが直下に並ぶ |
| ディレクトリエントリ | 無い。ファイルのパスだけが入っている |
| パス区切り | `/` |
| 最大のファイル | ログイン履歴（約 5MB） |

注意点が 2 つある。

- **`2XKO/` と `2xko/` が別フォルダとして両方入っている。** 大文字と小文字だけが違う。macOS のように大文字小文字を区別しないファイルシステムへ展開すると 1 つに統合される。アプリケーションではフォルダ名の大文字小文字を区別せずに扱う。
- **`league/` と `leagueoflegends/` は別フォルダである。** `league/` には音声書き起こしの 1 ファイルだけが入る。

### JSON の共通仕様

- 文字コードは UTF-8、BOM なし。日本語などの非 ASCII 文字を含むファイルがある。
- 1 行にまとまったファイルと、整形されたファイルが混在する。
- データが無い場合もファイル自体は存在し、中身は空配列 `[]` になる。通報件数のように入れ子のオブジェクトを持つファイルでは、空オブジェクト `{}` になる。
- 配列の並び順は時刻順とは限らない。表示する前に並べ替えが必要である。
- ファイル名の末尾に `_uc` が付くものが多い。意味は未確認。

### readme.csv

`text` という 1 列だけの CSV で、Riot のプライバシー通知への案内文が入っている。データではないので、読み込みの対象外にしてよい。

## ファイル一覧

「規模」はサンプルでのおおよその件数である。

### riotAccount（アカウント）

| ファイル | 内容 | 形 | 規模 |
|---|---|---|---|
| `account_info.json` | アカウントの基本情報 | オブジェクト | 1 件 |
| `account_audit_events_v1_uc.json` | アカウント変更の履歴（旧形式） | 配列 | 数十件 |
| `account_audit_events_v2_uc.json` | アカウント変更の履歴（新形式） | 配列 | 数十件 |
| `atlas_login_event_uc.json` | ログインや接続の履歴 | 配列 | 約 3 万件 |

### leagueoflegends（League of Legends）

| ファイル | 内容 | 形 | 規模 |
|---|---|---|---|
| `summoner.json` | サモナー情報 | オブジェクト | 1 件 |
| `clash.json` | Clash 用に登録した電話番号 | オブジェクト | 1 件 |
| `grouped_reports.json` | 通報の件数（した側、された側） | オブジェクト | 1 件 |
| `rp_purchase_history_uc.json` | RP を現金で購入した履歴 | 配列 | 数十件 |
| `store_transactions_uc.json` | ストアの取引履歴 | 配列 | 約 2 千件 |
| `chat_logs_v2_uc/successes/<game_id>.json` | 試合ごとのチャットログ | 1 試合 1 ファイル | 十数ファイル |

試合履歴のファイルは無い。

### teamfighttactics（Teamfight Tactics）

| ファイル | 内容 | 形 | 規模 |
|---|---|---|---|
| `tft_grouped_reports.json` | 通報の件数 | オブジェクト | 1 件 |
| `tft_chat_logs_v2_uc/successes/<game_id>.json` | 試合ごとのチャットログ | 1 試合 1 ファイル | 数ファイル |

試合履歴のファイルは無い。

### valorant（VALORANT）

| ファイル | 内容 | 形 | 規模 |
|---|---|---|---|
| `valorant_match_history_uc.json` | 試合履歴 | 配列 | 約 2 千件 |
| `valorant_payment_event_uc.json` | VP を現金で購入した履歴 | 配列 | 数件 |
| `valorant_purchase_event_uc.json` | ゲーム内通貨での購入履歴 | 配列 | 数十件 |
| `valorant_grouped_reports.json` | 通報の件数 | オブジェクト | 1 件 |
| `valorant_audio_transcripts_uc.json` | 音声書き起こし | 配列 | 空 |

### legendsofruneterra（Legends of Runeterra）

| ファイル | 内容 | 形 | 規模 |
|---|---|---|---|
| `lor_match_history_uc.json` | 試合履歴 | 配列 | 百数十件 |
| `lor_payment_history_event_uc.json` | コインを現金で購入した履歴 | 配列 | 数件 |
| `lor_purchase_history_event_uc.json` | ゲーム内通貨での購入履歴 | 配列 | 数十件 |

### wildrift（Wild Rift）

| ファイル | 内容 | 形 | 規模 |
|---|---|---|---|
| `wildrift_match_history_uc.json` | 試合履歴 | 配列 | 百数十件 |
| `wildrift_currency.json` | 通貨の現在残高 | オブジェクト | 1 件 |
| `wildrift_inventory.json` | 所持品 | オブジェクト | 1 件 |
| `wildrift_purchase_event_uc.json` | ゲーム内通貨での購入履歴 | 配列 | 十数件 |
| `wildrift_payment_event_uc.json` | 現金での購入履歴 | 配列 | 空 |

### そのほか

| ファイル | 内容 | 形 | 規模 |
|---|---|---|---|
| `penalties/penalty_history.json` | ペナルティの履歴 | 配列 | 数件 |
| `zendesk/zendesk_tickets.json` | サポートへの問い合わせ | オブジェクト | 数件 |

### サンプルでは空だったファイル

次のファイルは空配列だったので、項目の構成は分からない。

- `2XKO/2xko_chat_logs_uc.json`
- `2XKO/2xko_game_inventory_uc.json`
- `2XKO/2xko_game_match_history_uc.json`
- `2XKO/2xko_mission_progression_uc.json`
- `2XKO/2xko_payment_history_uc.json`
- `2XKO/2xko_purchase_history_uc.json`
- `2XKO/2xko_reward_history_uc.json`
- `2xko/2xko_audio_transcripts_uc.json`
- `alphi/alphi_chat.json`
- `league/league_audio_transcripts_uc.json`
- `valorant/valorant_audio_transcripts_uc.json`
- `wildrift/wildrift_payment_event_uc.json`

## 各ファイルの項目

型の表記は次のとおり。`str` は文字列、`int` は整数、`bool` は真偽値、`null` は値なしを表す。

### riotAccount/account_info.json

| 項目 | 型 | 内容 |
|---|---|---|
| `username` | str | ログイン用のユーザー名 |
| `game_name` | str | Riot ID のゲーム名部分 |
| `tagline` | str | Riot ID のタグライン部分 |
| `email` | str | メールアドレス |
| `date_of_birth` | str | 生年月日。`YYYY-MM-DD` |

### riotAccount/account_audit_events_v1_uc.json

サンプルでは 2018 年までの出来事が入っていた。

| 項目 | 型 | 内容 |
|---|---|---|
| `action` | str | 出来事の種類。大文字のスネークケース。観測した値: `ACCOUNT_STATE_CHANGED`、`PASSWORD_CHANGED`、`EMAIL_VALIDATION_REQUESTED`、`SEND_VALIDATION_EMAIL`、`EXCESSIVE_CHAT_TOXICITY` |
| `event_date` | str | 日時。書式 A または B（後述） |

### riotAccount/account_audit_events_v2_uc.json

サンプルでは 2019 年以降の出来事が入っていた。

| 項目 | 型 | 内容 |
|---|---|---|
| `event_type` | str | 出来事の種類。観測した値: `EMAIL`、`USER_FIELD_CHANGED`、`FEDERATED_IDENTITY_CREATED`、`LINKED_IDENTITY_CREATED`、`IDENTITY_LINK_SUCCESS`、`ANOMALOUS_ACTIVITY` |
| `description` | str / null | 補足。`EMAIL` では `delivered`、`USER_FIELD_CHANGED` では変更された項目名（例: `username`）。そのほかは null |
| `event_date` | str | 日時。書式 A |

### riotAccount/atlas_login_event_uc.json

もっとも件数が多いファイルである。サンプルでは 2016 年以降の記録が入っていた。

| 項目 | 型 | 内容 |
|---|---|---|
| `event_time_utc` | str | 日時（UTC）。書式 A |
| `event_type` | str | 出来事の種類（下表） |
| `product` | str / null | 対象のゲームやサービス（下表） |
| `ip_address` | str / null | IP アドレス。IPv4 と IPv6 が混在する。文字列 `Unknown` や null のこともある |

`product` ごとに現れる `event_type` が決まっている。

| `product` | 観測した `event_type` |
|---|---|
| `League/TFT PC` | `Login`、`Authentication`、`Logout User`、`Logout`、`Disconnect`、`Session Expired`、`Logout Deadpool`、`Logout Kick`、`Login Kick`、`Refresh`、`Replace` |
| `VALORANT` | `Connected`、`Closed`、`Purged`、`Expired` |
| `riot_client` | `Login`、`Logout`、`Disconnect`、`Session Kicked Out` |
| `TFTm` | `Login`、`Disconnect`、`Session Expired`、`Logout`、`Replace` |
| `TFT` | `Login`、`Logout`、`Disconnect` |
| `Wild Rift` | `Login` |
| `Legends of Runeterra` | `Session Start` |
| `lol` | `Login` |
| `rso-prod` | `Authentication` |
| `rso-authenticator-prod` | `Authentication` |
| null | `Authentication` |

- `ip_address` が `Unknown` や null になるのは、ほぼ `VALORANT` の記録である。`VALORANT` の記録のうち約 3 割が該当した。
- 「ログインした回数」を数えるときに、どの `event_type` を 1 回と数えるかはゲームごとに決める必要がある。

### leagueoflegends/summoner.json

| 項目 | 型 | 内容 |
|---|---|---|
| `lol_platform` | str | プラットフォーム ID。例: `JP1` |
| `riot_id` | str | Riot ID。`<ゲーム名>#<タグライン>` |

### leagueoflegends/clash.json

| 項目 | 型 | 内容 |
|---|---|---|
| `phone_number` | str | 電話番号。途中が `*` で伏せられている。`+NN******NNNN` の形 |

### grouped_reports.json（LoL、TFT、VALORANT 共通）

対象は `leagueoflegends/grouped_reports.json`、`teamfighttactics/tft_grouped_reports.json`、`valorant/valorant_grouped_reports.json` である。

| 項目 | 型 | 内容 |
|---|---|---|
| `reports_made` | オブジェクト | 自分が通報した件数。キーが通報の分類（大文字のスネークケース）、値が件数（int） |
| `reports_received` | オブジェクト | 自分が通報された件数。形は同じ |

該当が無いときは空オブジェクト `{}` になる。分類の一覧は固定の項目ではなく、該当したものだけがキーとして現れる。

観測した分類: `ASSISTING_ENEMY_TEAM`、`LEAVING_AFK`、`RANK_MANIPULATION`

### leagueoflegends/rp_purchase_history_uc.json

| 項目 | 型 | 内容 |
|---|---|---|
| `transaction_id` | str | 取引 ID。`<プラットフォーム接頭辞>-<UUID>`。`store_transactions_uc.json` の `id` と対応する |
| `transaction_number` | str | 決済側の取引番号。書式は決済手段によって違う |
| `created` | str | 日時。書式 A または B |
| `amount` | str | 支払額。**文字列**で、小数点以下の桁数がそろっていない（`35.0` と `35.00` など） |
| `currency_type` | str | 通貨コード。観測した値: `USD`、`JPY` |
| `payment_type` | str | 決済手段。観測した値: `Chase`、`PayonCreditCard`、`softbank-creditcard`、`SB_CreditCard`、`SB_PrepaidCard`、`paypal`。同じ決済手段と思われるものが別の表記で現れる（`softbank-creditcard` と `SB_CreditCard`） |
| `store_account_id` | int | ストアのアカウント ID。1 つのアカウントでも複数の値が現れる |
| `user_ip` | str | IP アドレス |

### leagueoflegends/store_transactions_uc.json

サンプルでは 2012 年以降の取引が入っていた。

| 項目 | 型 | 内容 |
|---|---|---|
| `id` | str | 取引 ID。`<プラットフォーム接頭辞>-<UUID>` |
| `created` | str | 日時。書式 A または B |
| `type` | str | 取引の種類（下表） |
| `item_id` | str | 対象の品目（後述） |
| `rp_delta` | int | RP の増減。支払いは負、獲得は正 |
| `rp_balance` | int | 取引後の RP 残高 |
| `ip_delta` | int | **IP アドレスではない。** 旧インフルエンスポイント（現ブルーエッセンス）の増減 |
| `ip_balance` | int | 取引後のブルーエッセンス残高 |
| `is_refunded` | str / null | 返金済みかどうか。`"0"` か `"1"` の**文字列**。古い記録（サンプルでは 2014 年 9 月まで）では null |
| `ip_address` | str | IP アドレス。`0.0.0.0` や `1.1.1.1` のような仮の値や、ホスト名のような文字列も入る |

`type` と通貨の増減の対応は次のとおり。

| `type` | RP | ブルーエッセンス |
|---|---|---|
| `PURCHASE` | 減る、または増減なし | 減る、または増減なし |
| `PURCHASE_BUNDLE_ITEM` | 増減なし | 増減なし |
| `PURCHASE_NON_REFUNDABLE` | 増減なし | 増減なし |
| `USER_PURCHASED_RP` | 増える | 増減なし |
| `USER_PURCHASED_RP_GIFT` | 増える | 増減なし |
| `RP_TRANSFER_RECEIVED` | 増える | 増減なし |
| `RP_TRANSFER_SENT` | 減る | 増減なし |
| `PURCHASED_GIFT` | 減る | 増減なし |
| `PURCHASED_MYSTERY_GIFT` | 減る、または増減なし | 減る、または増減なし |
| `MYSTERY_PURCHASE` | 増減なし | 減る、または増減なし |
| `MYSTERY_PERK` | 増減なし | 増減なし |
| `PERK` | 増減なし | 増減なし |
| `ITEM_TRANSFER_SENT` | 増減なし | 増減なし |
| `ITEM_TRANSFER_RECEIVED` | 増減なし | 増減なし |
| `REFUND` | 増える、または増減なし | 増える、または増減なし |
| `PROMO_REDEMPTION` | 増減なし | 増減なし |
| `COMMUNITY_REDEMPTION` | 増減なし | 増減なし |
| `LEAGUES_REWARD` | 増減なし | 増減なし |
| `RAF_REWARD` | 増減なし | 増える |

- `PURCHASE` の過半は RP もブルーエッセンスも増減しない行である。バンドルの中身やクラフトの結果が 1 品目ずつ記録されているためと考えられるが、未確認。
- `PURCHASE_BUNDLE_ITEM` はバンドルに含まれる品目を表す。

`item_id` は `<種別>_<数値>` の形をとる。

| 接頭辞 | 推定される内容 |
|---|---|
| `champions` | チャンピオン |
| `championsskin` | スキン |
| `summoner_icon` | サモナーアイコン |
| `emote` | エモート |
| `wardskin` | ワードスキン |
| `runes` | ルーン（旧ルーン、ルーンページ） |
| `hextech_crafting` | ヘクステッククラフトの品目 |
| `boosts` | ブースト |
| `bundles` | バンドル |
| `rp` | RP |
| `currency` | 通貨 |
| `summoner` | サモナー関連 |
| `tft_damage_skins` | TFT のダメージ演出 |
| `event_pass` | イベントパス |

例外の形もある。

- 空文字列
- 数値だけの値
- `bundles_<名前>` のように、末尾が数値でない値
- `account_transfer_<プラットフォーム>` のように、アカウント移行を表す値

数値を品目名に変換する対応表は zip に含まれない。Riot が公開しているゲームデータ（Data Dragon など）を別途使う必要がある。`championsskin` の数値が「チャンピオン ID × 1000 + スキン番号」である、という対応は未検証である。

### チャットログ（LoL、TFT）

対象は `leagueoflegends/chat_logs_v2_uc/successes/<game_id>.json` と `teamfighttactics/tft_chat_logs_v2_uc/successes/<game_id>.json` である。

- 1 試合につき 1 ファイルで、ファイル名は `game_id` と一致する。
- 発言が無かった試合もファイルは存在し、配列が空になる。
- サンプルに入っていたのは直近 2〜3 か月分の試合だけだった。
- フォルダ名が `successes` なので、取得に失敗した試合を入れる別フォルダがある可能性がある。未確認。

| 項目 | 型 | LoL | TFT | 内容 |
|---|---|---|---|---|
| `game_id` | int | あり | あり | 試合 ID |
| `platform_id` | str | あり | あり | プラットフォーム ID。小文字。例: `jp1` |
| `match_date_utc` | str | あり | あり | 試合日。**LoL は日付だけ（書式 G）、TFT は日時（書式 E）** |
| `match_id` | str | なし | あり | `<プラットフォーム ID の大文字>_<game_id>` |
| `product` | str | なし | あり | `tft` |
| `success` | bool | あり | あり | 取得に成功したか |
| `was_failure` | bool | あり | あり | 取得に失敗したか |
| `chat_logs` | オブジェクト | あり | あり | `pre_game`、`in_game`、`post_game` の 3 つの配列を持つ |

`chat_logs` の各配列の要素は次の形である。

| 項目 | 型 | 内容 |
|---|---|---|
| `chat` | str | 発言の本文 |
| `riot_id` | str | 発言者の Riot ID |
| `sent_to` | str | 宛先。観測した値: `TEAM`、`PARTY_<数値>` |
| `timestamp` | int | 発言時刻。Unix 時刻（ミリ秒） |

### valorant/valorant_match_history_uc.json

サンプルでは 2020 年以降の試合が入っていた。

| 項目 | 型 | 内容 |
|---|---|---|
| `game_id` | str | 試合 ID。UUID |
| `game_start_time_utc` | str | 開始日時（UTC）。書式 A |
| `game_end_time_utc` | str | 終了日時（UTC）。書式 A |
| `game_mode` | str | 大分類（下記） |
| `game_type` | str | 小分類（下記） |
| `game_outcome` | str | 勝敗。観測した値: `Win`、`Loss` |
| `realm_id` | str | 地域コード。例: `ap` |

エージェント、マップ、キル数、ラウンド数などの項目は無い。

`game_mode` で観測した値:

- `Matchmaking`
- `ShootingRange`
- `Custom Game`
- `Tournament`
- `New Player Experience`

`game_type` で観測した値:

- 一般的な名前のもの: `Ranked`、`Unrated`、`Deathmatch`、`Spike Rush`、`Swiftplay`、`Premier`
- 内部コード名と思われるもの: `Hurm`、`Newmap`、`Ggteam`、`Fortcollins`、`Skirmish2V2`、`Onefa`
- 分類なし: `Not Applicable`、`Unknown`

注意点:

- `game_mode` が `Matchmaking` 以外のとき、`game_type` は `Not Applicable` になる。
- `ShootingRange`（射撃場）は `game_outcome` がすべて `Loss` になる。`Deathmatch` もほぼすべて `Loss` である。勝率の計算からは除く必要がある。
- 引き分けを表す値は観測していない。引き分けがどう記録されるかは未確認。
- 内部コード名を表示名に変換する対応表は未作成である。

### valorant/valorant_payment_event_uc.json

| 項目 | 型 | 内容 |
|---|---|---|
| `player_facing_purchase_id` | str | 購入 ID。英大文字と数字の 12 文字 |
| `payment_time_utc` | str | 日時（UTC）。書式 A |
| `payment_method` | str | 決済手段。観測した値: `paypal`、`softbank-creditcard` |
| `country_code` | str | 国コード。**2 文字と 3 文字の表記が混在する** |
| `currency_code` | str | 通貨コード。例: `JPY` |
| `real_currency_paid_x100` | int | 支払額を 100 倍した値。日本円のように補助単位が無い通貨でも 100 倍されている |
| `game_currency_granted` | int | 付与されたゲーム内通貨の量 |
| `game_currency_type` | str | ゲーム内通貨の種類。観測した値: `VP` |
| `recipient_id` | null | 贈り先。サンプルではすべて null |

### valorant/valorant_purchase_event_uc.json

| 項目 | 型 | 内容 |
|---|---|---|
| `transaction_id` | str | 取引 ID |
| `purchase_date` | str | 日時。書式 C |
| `transaction_type` | str | 観測した値: `Purchase`、`Unlock` |
| `transaction_source` | str | 購入の経路。例: `Bundle`、`Gun Upgrade`、`Item Level Upgrade`、`Agent Store`。**先頭に空白が付いた値がある** |
| `item_type` | str | 観測した値: `Item`、`Bundle`、`BP Bundle`、`BP Item`、`Char Bundle` |
| `item_name` | str | 品目名。**改行（`\r\n`）を含むことがある** |
| `spent_currency_name` | str | 支払った通貨。観測した値: `VALORANT Points`、`Radianite Points`、`Character Recruitment Token` |
| `spent_currency_amount` | int / null | 支払った量 |

### legendsofruneterra/lor_match_history_uc.json

サンプルでは 2019 年から 2023 年の試合が入っていた。

| 項目 | 型 | 内容 |
|---|---|---|
| `game_id` | str | 試合 ID。UUID。**重複する行がある** |
| `game_start_time_utc` | str | 開始日時（UTC）。書式 D または E |
| `game_end_time_utc` | str | 終了日時（UTC）。書式 D または E |
| `game_time_seconds` | int | 試合時間（秒）。0 のこともある |
| `play_time_seconds` | int | プレイ時間（秒）。サンプルでは全行で `game_time_seconds` と同じ値 |
| `total_turn_count` | int | ターン数 |
| `order_of_play` | int | 手番。観測した値: 0、1、2。それぞれの意味は未確認 |
| `game_mode` | str | 観測した値: `Constructed`、`Tutorial <名前>` |
| `game_type` | str | 観測した値: `Ranked`、`Normal`、`AI` |
| `is_ai` | bool | 対 AI 戦かどうか。**`game_type` が `AI` の行でも false だった。** 信頼できない |
| `game_outcome` | str | 観測した値: `Victory`、`Defeat` |
| `game_outcome_reason` | str | 決着の理由。観測した値: `Concession`、`Zero Health`、`Disconnect` |
| `deck_id` | str | デッキ ID。UUID。カード構成を復元できるデッキコードではない |
| `faction1`、`faction2`、`faction3` | str | デッキの地域。例: `Demacia`、`Shadow Isles`。値が無いときは `Unknown`。`faction3` はサンプルではすべて `Unknown` |
| `platform` | str | 観測した値: `Android`、`Windows` |
| `realm_id` | str | 地域。観測した値: `asia`、`sea`、`Unknown` |
| `country` | str | 国。サンプルではすべて `Unknown` |

### legendsofruneterra/lor_payment_history_event_uc.json

`valorant_payment_event_uc.json` とほぼ同じ構成だが、項目に差がある。

| 項目 | 型 | 内容 |
|---|---|---|
| `player_facing_purchase_id` | str | 購入 ID。英大文字と数字の 12 文字 |
| `payment_time_utc` | str | 日時（UTC）。書式 A |
| `payment_method` | str | 決済手段。観測した値: `paypal` |
| `is_prepaid_card` | bool | プリペイドカードでの支払いかどうか |
| `country_code` | str | 国コード |
| `currency_code` | str | 通貨コード |
| `real_currency_paid_x100` | int | 支払額を 100 倍した値 |
| `game_currency_granted` | int | 付与されたコインの量 |

VALORANT にある `game_currency_type` と `recipient_id` は無い。VALORANT に無い `is_prepaid_card` がある。

### legendsofruneterra/lor_purchase_history_event_uc.json

| 項目 | 型 | 内容 |
|---|---|---|
| `transaction_id` | str | 取引 ID。UUID。**複数の行が同じ ID を持つことがある。** 1 回の購入で複数の品目を得た場合と考えられるが、未確認 |
| `purchase_time_utc` | str | 日時（UTC）。書式 F |
| `purchased_item_name` | str | 得た品目の名前 |
| `purchased_item_type` | str | 観測した値: `Card`、`Wildcard`、`CardCollectionEntitledLoot` |
| `purchased_item_amount` | int | 得た数 |
| `purchased_item_new_balance` | int | 取得後の所持数 |
| `spent_item_name` | str | 支払ったものの名前。観測した値: `Coins`、`Shards`、`Common Wildcard`、`Rare Wildcard`、`Epic Wildcard`、`Champion Wildcard` |
| `spent_item_type` | str | 観測した値: `Coin`、`Shard`、`Wildcard` |
| `spent_item_amount` | int | 支払った量。0 のこともある |
| `spent_item_new_balance` | int | 支払い後の残高 |
| `runtime_platform` | str | 観測した値: `Windows`、`Android` |
| `realm_id` | str | 地域。観測した値: `asia`、`sea` |
| `transaction_source` | str | サンプルではすべて `DEPRECATED` |
| `ip_address` | null | サンプルではすべて null |

### wildrift/wildrift_match_history_uc.json

サンプルでは 2020 年から 2024 年の試合が入っていた。

| 項目 | 型 | 内容 |
|---|---|---|
| `game_id` | str | 試合 ID。18 桁の数字。末尾に `-<数値>` が付く行もある |
| `game_start_time_utc` | str / null | 開始日時（UTC）。書式 A |
| `game_end_time_utc` | str / null | 終了日時（UTC）。書式 A |
| `game_mode` | str | 観測した値: `Summoner's Rift`、`Duel`、`Tutorial <名前>` |
| `game_type` | str | 観測した値: `Ranked`、`Normal`、`AI`、`Duel`、`Co-op vs. AI` |
| `game_outcome` | str | 観測した値: `Victory`、`Defeat`、`Noncompetitive` |
| `player_rank` | str / null | その時点のランク。`<ティア> <ローマ数字>` の形。例: `Gold III`。`game_type` が `AI` の行では null |
| `account_level` | int | その時点のアカウントレベル |

- `Noncompetitive` は `game_type` が `AI`（チュートリアル）、`Co-op vs. AI`、`Duel` の行に付く。勝率の計算からは除く。
- 使用チャンピオン、KDA などの項目は無い。

### wildrift/wildrift_currency.json

| 項目 | 型 | 内容 |
|---|---|---|
| `blue_motes` | str | ブルーモートの残高 |
| `poro_coins` | str | ポロコインの残高 |
| `wild_cores` | str | ワイルドコアの残高 |

値は数値だが、**文字列**として入っている。

### wildrift/wildrift_inventory.json

| 項目 | 型 | 内容 |
|---|---|---|
| `champions` | str の配列 | 所持チャンピオンの名前 |
| `skins` | オブジェクトの配列 | 所持スキン。`champion_name` と `skin_name` を持つ |
| `emotes` | str の配列 | エモートの名前 |
| `summoner_icons` | str の配列 | サモナーアイコンの名前 |
| `icon_borders` | str の配列 | アイコン枠の名前 |
| `banners` | str の配列 | バナーの名前 |
| `baubles` | str の配列 | 飾りの名前 |
| `backpack` | オブジェクトの配列 | 消耗品。`name`（str）と `quantity`（int）を持つ |

- **`skins` の 2 つの項目は名前と中身が入れ替わっている。** `champion_name` にスキン名（例: `Spellthief Lux`）、`skin_name` にチャンピオン名（例: `Lux`）が入っていた。サンプルの全行でそうだった。
- 名前の末尾に改行が付いた値がある。表示する前に前後の空白を取り除く。
- 名前は英語表記で入っている。

### wildrift/wildrift_purchase_event_uc.json

| 項目 | 型 | 内容 |
|---|---|---|
| `purchase_date` | str | 日時。書式 A |
| `transaction_type` | str | 観測した値: `Purchase` |
| `transaction_source` | str | 観測した値: `Store`、`Poro Store`、`Ranked Store`、`Collection` |
| `item_type` | str | 観測した値: `Champion`、`Skin`、`Pose`、`Bundle` |
| `item_name` | str / null | 品目名 |
| `spent_currency_name` | str | 観測した値: `Blue Motes`、`Poro Coins`、`Ranked Coins`、`Wild Cores` |
| `spent_currency_amount` | int | 支払った量。0 のこともある |
| `transaction_id` | null | サンプルではすべて null |

### penalties/penalty_history.json

| 項目 | 型 | 内容 |
|---|---|---|
| `date_issued` | str | 発行日時。書式 H |
| `scope` | str | 対象のゲーム。観測した値: `LEAGUE_OF_LEGENDS` |
| `restriction_type` | str | 制限の種類。観測した値: `CHAT_RESTRICTION`、`SUSPENSION` |
| `restriction_reason` | str | 理由。観測した値: `DISRUPTIVE_COMMUNICATION` |
| `sentence` | str | 処分の形。観測した値: `TIMEOUT` |
| `status` | str | 現在の状態。観測した値: `LAPSED` |
| `is_manual` | bool | 手動で発行されたかどうか |

値はすべて大文字のスネークケースである。制限の期間や終了日時を表す項目は無い。

### zendesk/zendesk_tickets.json

最上位はオブジェクトで、キーがチケット ID、値がチケットである。

| 項目 | 型 | 内容 |
|---|---|---|
| `ticket_id` | str | チケット ID。キーと同じ値 |
| `subject` | str | 件名 |
| `status` | str | 状態。観測した値: `open`、`closed`、`deleted` |
| `create_datetime` | str | 作成日時。書式 A |
| `comments` | オブジェクトの配列 | やりとり（下表） |

`comments` の要素は次の形である。

| 項目 | 型 | 内容 |
|---|---|---|
| `author` | str | 書き手。観測した値: `Player`、`Agent` |
| `comment` | str | 本文。長い自由記述で、改行を含む |
| `create_datetime` | str | 投稿日時。書式 A |

## 日時の書式

日時の書式はファイルごとに違い、同じファイルの中で混在することもある。

| 記号 | 書式 | 例 | 使われている場所 |
|---|---|---|---|
| A | `YYYY-MM-DD HH:MM:SS` | `2020-01-02 03:04:05` | ログイン履歴、VALORANT と Wild Rift の試合履歴、LoL のストア取引と RP 購入、VALORANT と LoR の課金履歴、Wild Rift の購入履歴、問い合わせ、アカウント変更履歴 |
| B | 書式 A の末尾に `.0` | `2013-01-02 03:04:05.0` | LoL のストア取引と RP 購入の古い記録（サンプルでは 2014 年 9 月まで）、アカウント変更履歴 v1 の一部 |
| C | 書式 A の末尾に 1〜6 桁の小数秒 | `2020-01-02 03:04:05.123` | VALORANT の購入履歴 |
| D | `YYYY-MM-DDTHH:MM:SS.ffffff+0000` | `2019-01-02T03:04:05.123456+0000` | LoR の試合履歴の古い記録（サンプルでは 2019 年の分） |
| E | `YYYY-MM-DDTHH:MM:SS.ffffff+00:00` | `2021-01-02T03:04:05.123456+00:00` | LoR の試合履歴、TFT のチャットログ |
| F | 書式 E の小数秒が 7 桁 | `2020-01-02T03:04:05.1234567+00:00` | LoR の購入履歴 |
| G | `YYYY-MM-DD` | `2026-01-02` | LoL のチャットログ |
| H | `YYYY-MM-DDTHH:MM:SSZ` | `2018-01-02T03:04:05Z` | ペナルティ履歴 |
| I | Unix 時刻（ミリ秒）の整数 | `1700000000000` | チャットの発言時刻 |

- 項目名が `_utc` で終わるものは UTC と読める。
- `created`、`purchase_date`、`event_date`、`create_datetime` はタイムゾーンの記載が無い。UTC かどうかは未確認。
- 書式 D と F は標準的な ISO 8601 の解釈器で失敗するおそれがある。読み込み時に自前で正規化する。

## 読み込み時の注意点

### 値の表記ゆれ

- **数値が文字列で入っている項目がある。** LoL の `amount` と `is_refunded`、Wild Rift の通貨残高が該当する。
- **「値なし」の表し方が統一されていない。** null、文字列 `Unknown`、文字列 `Not Applicable`、空文字列が使われる。
- **勝敗の表記がゲームごとに違う。** VALORANT は `Win` / `Loss`、LoR と Wild Rift は `Victory` / `Defeat` である。
- **文字列に余分な空白や改行が付くことがある。** VALORANT の `transaction_source` と `item_name`、Wild Rift の所持品名で観測した。
- **支払額の単位がファイルごとに違う。** LoL の `amount` は通貨そのままの金額、VALORANT と LoR の `real_currency_paid_x100` は 100 倍した値である。

### 個人情報を含む項目

| 種類 | 場所 |
|---|---|
| IP アドレス | ログイン履歴の `ip_address`、LoL ストア取引の `ip_address`、LoL RP 購入の `user_ip` |
| メールアドレス、生年月日、ユーザー名 | `riotAccount/account_info.json` |
| 電話番号（一部伏せ字） | `leagueoflegends/clash.json` |
| Riot ID | `account_info.json`、`summoner.json`、チャットログの `riot_id`、zip のファイル名 |
| チャットの本文 | LoL と TFT のチャットログ |
| 問い合わせの本文 | `zendesk/zendesk_tickets.json` |
| 決済の取引番号、決済手段 | LoL RP 購入、VALORANT と LoR の課金履歴 |
| ペナルティ、通報の履歴 | `penalties/penalty_history.json`、各ゲームの `grouped_reports.json` |

### ファイル間の対応

- LoL の `rp_purchase_history_uc.json` の `transaction_id` は、`store_transactions_uc.json` で `type` が `USER_PURCHASED_RP` または `USER_PURCHASED_RP_GIFT` の行の `id` と一致する。サンプルでは全件が対応した。
- TFT のチャットログの `match_id` は、`platform_id` を大文字にしたものと `game_id` を `_` でつないだ値である。
- それ以外に、ファイルをまたいで行を結び付けられる共通の ID は見つかっていない。試合履歴とチャットログ、試合履歴とログイン履歴は、時刻で突き合わせるしかない。

## 未確認の事項

- サンプルで空だったファイル（2XKO、音声書き起こし、`alphi`、Wild Rift の現金購入）の項目構成
- チャットログの `successes` に対応する、失敗時のフォルダの有無と中身
- `_uc` という接尾辞の意味
- タイムゾーンの記載が無い日時項目が UTC かどうか
- VALORANT の内部コード名（`Hurm` など）と表示名の対応
- VALORANT の引き分けの記録のされ方
- LoR の `order_of_play` の値の意味
- LoL の `item_id` の数値と品目名の対応
- 各ファイルの保持期間（どこまでさかのぼって開示されるか）
- 他の地域や他の言語設定のアカウントで、値の表記が変わるかどうか
