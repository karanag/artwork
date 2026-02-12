# Rug Artwork Web

Local-first Vite + React app for rug artwork workflow with Firebase Storage and Firestore.

## Run locally

```bash
npm install
npm run dev
```

## Required environment variables

Create `.env.local` with:

```bash
VITE_FB_API_KEY=...
VITE_FB_AUTH_DOMAIN=...
VITE_FB_PROJECT_ID=...
VITE_FB_STORAGE_BUCKET=...
VITE_FB_MESSAGING_SENDER_ID=...
VITE_FB_APP_ID=...
```

If these are missing, the UI shows:
`Firebase env vars missing. Create .env.local with VITE_FB_* values.`

## Firestore collections expected

- `poms`
- `textures`
- `artworks` (created by this app)

## Internal app note

No authentication is implemented in this project. Use Firebase rules appropriate for internal-only usage.
