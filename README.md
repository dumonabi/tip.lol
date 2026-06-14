# Cashu Gift

Private gift pages for **Cashu** ecash. Create an unguessable link, attach tokens, share the link — the recipient opens it and **immediately** sees their Cashu QR, wallet downloads, and a countdown until expiry.

## How it works

1. **Open the site** — a random private page is created instantly (no button).
2. **Fill the form** — Cashu token, message, email, and phone in one step.
3. **Publish** — share the link; recipient sees Cashu QR and wallets immediately.

Each page holds **one Cashu token** — not a wallet. The balance stays in sync with the mint when someone opens the page.

## Run locally

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001

## Features

| Feature | Status |
|---------|--------|
| Secret unguessable links | ✅ |
| Instant Cashu QR on page open | ✅ |
| Auto token file download (once per session) | ✅ |
| Wallet download buttons above the fold | ✅ |
| 365-day expiry from funding | ✅ |
| Auto-delete abandoned / expired pages | ✅ |
| “Already claimed” grace period (7 days) | ✅ |
| Live countdown (`364 days left`, …) | ✅ |
| Mint balance sync (partial spend / external redeem) | ✅ |
| Email notification | 🔜 Saved, not sent yet |
| WhatsApp notification | 🔜 Saved, not sent yet |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | API + Vite dev server |
| `npm run build` | Production frontend build |
| `npm run start` | Serve API + built frontend |

## Security notes

- The link **is** the key — anyone with it can view and copy tokens.
- Pages expire **365 days** after funding.
- **Unpublished** pages (no Cashu attached) are removed after **1 hour**.
- **Claimed** pages show an “already claimed” message for **7 days**, then are deleted.
- **Expired** or **token-less** pages are deleted automatically (on access and hourly cleanup).
- Tokens are stored in SQLite (`data/gift.db`) on your server.

## Production

```bash
npm run build
NODE_ENV=production npm run start
```
