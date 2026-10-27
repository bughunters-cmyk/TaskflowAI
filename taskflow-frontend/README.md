# TaskFlow AI – Multi-tenant Frontend

Clean, professional Next.js frontend for the multi-tenant TaskFlow AI backend.

## Setup

1. **Install dependencies**
   ```bash
   cd taskflow-frontend
   npm install
   ```

2. **Environment**
   Create `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://hcnikzczmtnkvksqbtsd.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-from-supabase
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

   Get the **anon key** from Supabase → Settings → API → `anon` `public` key.

3. **Run**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

## Features

- Email + password auth (Supabase Auth)
- Create / join firms (multi-tenant)
- Firm switcher in sidebar
- Upload audio or paste transcript → extract tasks
- Review & approve/reject tasks (admins)
- Connect multiple Trello boards per firm
- Member management (kick / leave)
- Fully scoped data (you only see your firm’s meetings & tasks)

## Backend requirements

Make sure the multi-tenant FastAPI backend is running and the SQL migration has been applied.
