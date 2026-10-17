# Worship Ministry Scheduler

<div align="center">

![Next.js 16](https://img.shields.io/badge/Next.js_16-black?style=for-the-badge&logo=next.js&logoColor=white)
![React 19](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase_PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

<br/>

**A neo-brutalist web application designed for church worship teams to coordinate services, manage roles, and roster musicians seamlessly.**

<br/>

<img src="./public/screenshots/cover.png" alt="Worship Ministry Scheduler Cover" width="100%" style="border-radius: 8px; border: 4px solid #111111; box-shadow: 6px 6px 0px #111111;" />

</div>

---

## Overview

**Worship Ministry Scheduler** helps worship teams organize upcoming services, manage volunteer sign-ups, and avoid scheduling conflicts across Sound, Vocals, and Band members. The application features a distinctive neo-brutalist sticker design with high-contrast borders and tactile controls.

---

## Core Features

- **Service Scheduling**: Browse upcoming services (next 30 days) and navigate monthly calendars with live roster availability.
- **Role Registration & Conflict Prevention**: Sign up for Sound, Singer, or Musician roles with automated duplicate checks to avoid double-booking.
- **Admin Management**: Dedicated portal (`/admin`) for leaders to create events, manage assignments, and review ministry statistics.
- **Authentication & Profiles**: Supports Email/Password and Google OAuth with custom avatar upload and cropping via Supabase Storage.
- **Optimized Performance**: Serverless execution colocated in Singapore (`sin1`) with Supabase PostgreSQL, table indexes, and connection pooling for sub-10ms latency.

---

## Tech Stack

- **Frontend**: Next.js 16 (App Router, Server Actions), React 19, Tailwind CSS v4, Lucide Icons, Sonner
- **Backend & Database**: Supabase PostgreSQL (`aws-0-ap-southeast-1`), Node.js `pg` Pool
- **Auth & Storage**: Jose (JWT HTTP-only cookies), Google OAuth 2.0, Supabase Storage
- **Deployment**: Vercel (`sin1` Singapore region)

---

## Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/TrucmaiUS/worship-team-scheduler.git
cd worship-team-scheduler
npm install
```

### 2. Environment Variables

Create `.env.local` in the project root:

```env
DATABASE_URL="postgresql://postgres.[project-id]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
NEXT_PUBLIC_SUPABASE_URL="https://[project-id].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
JWT_SECRET="your-jwt-secret"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## License

This project is licensed under the [MIT License](LICENSE).
