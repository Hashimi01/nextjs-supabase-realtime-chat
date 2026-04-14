# Realtime Chat Workspace

Private, self-hosted realtime chat workspace built with Next.js and Supabase.

## Features

- Email-based authentication via Supabase Auth
- Public realtime chat room with file & audio message support
- Private direct message threads with realtime notifications
- User profiles with avatar uploads (Cloudinary or Supabase Storage)
- Audio message recording and playback
- Email notifications for new direct messages
- Arabic (RTL) and English (LTR) internationalization
- Dark theme with glass-morphism design

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (Pages Router) |
| UI | React 18, Framer Motion |
| Backend / Auth | Supabase (Postgres + Realtime + Auth) |
| File Uploads | Cloudinary (optional) or Supabase Storage |
| Email | Nodemailer (SMTP) |
| i18n | Custom hook — Arabic & English |

## Requirements

- Node.js >= 20.9.0
- A [Supabase](https://supabase.com) project

## Local Setup

1. **Install dependencies:**

```bash
npm install
```

2. **Configure environment variables:**

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in your Supabase URL, anon key, and any optional
SMTP / Cloudinary values. See [ENV_EXAMPLE.md](ENV_EXAMPLE.md) for detailed
notes on each variable.

3. **Apply the database schema:**

Run the SQL in [`database.sql`](database.sql) against your Supabase project via
the Supabase SQL Editor or the CLI. See [DATABASE_SETUP.md](DATABASE_SETUP.md)
for step-by-step instructions.

4. **Start the development server:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the local development server |
| `npm run build` | Create the production build |
| `npm run start` | Run the production server |
| `npm run lint` | Lint the project with Next.js rules |

## Project Structure

```
/components        React components (Chat, DirectMessages, Auth, Profile …)
/pages             Next.js pages and API routes
/utils             Supabase client, file upload helpers, i18n hook
/styles            CSS modules (dark theme, design tokens)
/public            Static assets
database.sql       Postgres schema, RLS policies, and triggers
```

## Guides

- [DATABASE_SETUP.md](DATABASE_SETUP.md) — schema and RLS setup
- [REALTIME_SETUP.md](REALTIME_SETUP.md) — enabling Supabase Realtime
- [CLOUDINARY_SETUP.md](CLOUDINARY_SETUP.md) — configuring file uploads
- [ENV_EXAMPLE.md](ENV_EXAMPLE.md) — full environment variable reference

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
