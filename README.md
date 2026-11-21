# riot-data-dashboard

Riot Games のデータ開示で届いた zip を読み込み、自分のアカウントの記録を表示するダッシュボードです。

zip の展開と集計はすべてブラウザの中で行います。ファイルの中身はサーバーに送信しません。

このサイトは Riot Games が提供または承認するものではありません。

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

画面の見た目は、数年分の合成データで確かめられます。次のコマンドで zip を作り、画面から読み込みます。

```sh
node scripts/make-demo-zip.ts <出力先のパス>
```
