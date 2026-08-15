# Digital Membership Card SaaS

LINE LIFFと連携する、複数店舗対応のデジタル会員証です。店舗管理者はSupabase Authで登録し、1アカウントにつき1店舗を管理します。

## ローカルセットアップ

```bash
npm install
npm run db:up
npm run db:migrate:local
cp .env.example .env.local
npm run dev
```

ローカルではSupabase CLIがAuth・Postgres・Storage・Studio・メール受信環境を起動します。

- API: `http://127.0.0.1:55321`
- Database: `127.0.0.1:55322`
- Studio: `http://127.0.0.1:55323`
- Mailpit: `http://127.0.0.1:55324`

現在の接続情報は `npm run supabase:status -- -o env` で確認できます。
停止は `npm run db:down`、DBを作り直す場合は `npm run db:reset` を使用してください。

## 店舗登録フロー

1. `/admin/signup` で管理者アカウントを作成
2. 確認メール経由でSupabase Authのセッションを開始
3. `/admin/onboarding` で店舗名・URL slug・LINE設定を登録
4. `/admin/store-settings` でブランドやLINE設定を変更
5. 会員証は `/s/{店舗slug}` で公開

LIFF endpoint URLは店舗ごとに `https://YOUR_DOMAIN/s/{店舗slug}` を設定してください。

## DBマイグレーション

```bash
npm run db:migrate:local
npx prisma generate
```

本番ではGitHub Actionsの `.github/workflows/prisma-migrate-deploy.yml` が
`npx prisma migrate deploy` を実行します。`DATABASE_URL` と `DIRECT_URL` をRepository Secretsに設定してください。

## 主な構成

- `src/app/s/[slug]`: 店舗別の会員証
- `src/app/admin`: 店舗管理画面
- `src/lib/supabase`: Supabase Authクライアント
- `src/orpc/router.ts`: 会員機能API
- `prisma/schema.prisma`: 店舗テナントを含むデータモデル
