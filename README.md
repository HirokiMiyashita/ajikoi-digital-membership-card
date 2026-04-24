# Ajikoi Digital Membership Card (LIFF Starter)

This project is a Next.js starter for a LIFF app.

## 1) Setup

Create your local env file:

```bash
cp .env.example .env.local
```

Then set your LIFF ID in `.env.local`:

```bash
NEXT_PUBLIC_LIFF_ID=YOUR_LIFF_ID_HERE
```

## 2) Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 3) Deploy to Vercel

Deploy this project to Vercel and copy the production URL:

- Example: `https://ajikoi-digital-membership-card.vercel.app`

Set that URL (or a specific path like `/`) as the LIFF endpoint URL in LINE Developers.

## 4) LIFF settings checklist

- LIFF endpoint URL: `https://...` (HTTPS required)
- Scope: `openid` and `profile` are required for profile access
- Use the generated LIFF ID in `NEXT_PUBLIC_LIFF_ID`
