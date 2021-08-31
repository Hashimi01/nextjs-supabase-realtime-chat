# Realtime Chat Workspace

Private, self-hosted realtime chat workspace built with Next.js and Supabase.

## Snapshot

- Baseline edition date: `31 Aug 2021`
- Stack: `Next.js`, `React`, `Supabase`
- Scope: authentication, public chat, direct messages, and user profile flows

## Features

- Email-based authentication through Supabase
- Public realtime chat room
- Private direct message threads
- Profile view for signed-in users
- Responsive sidebar navigation for desktop and mobile

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local `.env` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_API_KEY=<your-supabase-anon-key>
NEXT_PUBLIC_SITE_URL=<your-public-app-url>
```

3. Start the development server:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Available Scripts

- `npm run dev` starts the local development server
- `npm run build` creates the production build
- `npm run start` runs the production server
- `npm run lint` checks the project with Next.js lint rules

## Project Notes

- App metadata and browser icons live in `pages/` and `public/`
- Supabase credentials are required for authentication and realtime features
- Project governance files under `.github/` were customized for a private deployment workflow

## License

This project is distributed under the MIT License. See `LICENSE` for the current terms.
