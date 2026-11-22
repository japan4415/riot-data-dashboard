# riot-data-dashboard

Riot Games のデータ開示で届いた zip を読み込み、自分のアカウントの記録を表示するダッシュボードです。

zip の展開と集計はすべてブラウザの中で行います。ファイルの中身はサーバーに送信しません。

このサイトは Riot Games が提供または承認するものではありません。
Riot Games と、それに関連する名称は、Riot Games, Inc. の商標または登録商標です。

riot-data-dashboard was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.

## できること

| 画面 | 内容 |
|---|---|
| 概要、活動 | 活動した日数、試合数、プレイ時間、活動カレンダー、曜日と時刻のヒートマップ |
| League of Legends | ストアの取引、RP とブルーエッセンスの残高の推移、スキンが多いチャンピオン、贈り物 |
| VALORANT、Legends of Runeterra、Wild Rift | 試合数、勝率、種別ごとの勝敗、購入の一覧など |
| 課金 | 通貨ごとの合計、年ごとの課金額、累計の推移 |
| アカウント | 登録情報、変更履歴、ペナルティ、問い合わせ、チャットログ、IP アドレスの一覧 |

- 開示データが手元に無くても、「サンプルデータで試す」から画面を試せます。
- 上部の「伏せ字」を入れると、Riot ID や本文を伏せます。画面をそのまま人に見せられます。

## ドキュメント

| ファイル | 内容 |
|---|---|
| [docs/original.md](docs/original.md) | 要求の正本。人間のみが編集する |
| [docs/data-structure.md](docs/data-structure.md) | データ開示 zip の構造 |
| [docs/design.md](docs/design.md) | アプリケーションの設計 |

## 開発

Node.js 22 以上と pnpm が必要です。

```sh
pnpm install
pnpm run dev
```

| コマンド | 内容 |
|---|---|
| `pnpm run dev` | 開発サーバーを起動する |
| `pnpm run build` | 本番用にビルドする |
| `pnpm run check` | 整形の検査、型検査、テストをまとめて実行する |
| `pnpm run lint:fix` | 整形と自動修正を行う |
| `pnpm run test` | テストを実行する |

ビルドとデプロイには Cloudflare の `cf` コマンドを使います。`wrangler` は使いません。

## デプロイ

検査とデプロイは Cloudflare Builds で行います。GitHub Actions は使いません。

- main 以外のブランチへ push すると、検査（`pnpm run check`）のあとにプレビューを作ります。
- main へマージすると、検査のあとに `pnpm exec cf deploy` で公開します。

Worker の設定は `cloudflare.config.ts` にあります。

## テスト用データについて

実物の開示データには個人情報が含まれます。リポジトリには入れないでください。
テストには、手で合成したデータ（`tests/fixtures/syntheticExport.ts`）だけを使います。

手元の zip を読み込めるかは、次のコマンドで確かめられます。
表示するのは件数と合計だけで、個人の値は表示しません。

```sh
node scripts/import-report.ts <zip のパス>
```

画面の見た目は、数年分の合成データで確かめられます。画面の「サンプルデータで試す」から読み込めます。
同じデータを zip として書き出すこともできます。

```sh
node scripts/make-demo-zip.ts <出力先のパス>
```

## League of Legends の品目名について

ストアの取引に入っている品目 ID のうち、チャンピオンとスキンは名前に直して表示します。
対応表（`src/labels/data/lolItems.json`）は、Riot Games が公開している静的データ（Data Dragon）から作り、リポジトリに同梱しています。
アプリケーションは、実行時にこのデータを取得しません。

新しいチャンピオンやスキンが加わったら、次のコマンドで対応表を作り直し、結果をコミットします。
このコマンドは Data Dragon からデータを取得します。

```sh
node scripts/update-lol-items.ts
```
