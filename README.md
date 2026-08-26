# Jomla Link Studio

Private, single-user catalog production studio powered by Gemini.

## Vercel setup

1. Import this repository into Vercel.
2. Add a free Neon Postgres database and copy its connection string to `DATABASE_URL`.
3. Add `GEMINI_MASTER_KEY`, `STUDIO_USERNAME`, and `STUDIO_PASSWORD`.
4. Deploy, open Settings in the app, and save the Gemini API key.
5. Add `studio.jomlalink.com` under Project Settings → Domains.

The application creates its required Postgres tables automatically on first use.
