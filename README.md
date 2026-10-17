# 🎸 Worship Ministry Scheduler

<div align="center">

![Next.js 16](https://img.shields.io/badge/Next.js_16-black?style=for-the-badge&logo=next.js&logoColor=white)
![React 19](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS_v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase_PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel_sin1-000000?style=for-the-badge&logo=vercel&logoColor=white)

<br/>

**A modern, high-performance web application designed for church worship teams to coordinate services, manage ministry roles, and roster musicians with style.**

[Explore Features](#-key-features) • [Screenshots](#-screenshots) • [Tech Stack](#-tech-stack) • [Getting Started](#-getting-started) • [Architecture](#-project-structure)

<br/>

<img src="./public/screenshots/home.png" alt="Worship Ministry Scheduler Landing Banner" width="90%" style="border-radius: 8px; box-shadow: 6px 6px 0px #111111; border: 4px solid #111111;" />

</div>

---

## 📖 Overview

The **Worship Ministry Scheduler** streamlines Sunday services, prayer nights, and special worship events. Team members can easily check upcoming events, sign up for available roles (Sound Engineers, Singers, Musicians), and update or cancel their registrations in real-time. Team leaders and administrators receive an all-in-one dashboard to schedule services, assign roles, and monitor team availability.

Crafted with a distinct **Neo-Brutalist & Sticker Aesthetic** — featuring bold 4px borders, hard drop-shadows, retro pop accent palettes, and tactile sticker badges.

---

## ✨ Key Features

### 📅 Smart Worship Calendar & Upcoming Services
- **Rolling Upcoming Feed**: Automatically surfaces all worship services scheduled within the next 30 days.
- **Monthly Grid Navigation**: Jump forward or backward through monthly schedules with real-time dynamic date calculations.
- **Visual Roster Indicators**: Badges like `NEEDS PEOPLE` highlight services requiring more volunteers.

### 🎤 Role Management & Conflict Prevention
- **Three Distinct Teams**:
  - 🎛️ **Sound Team** (`SOUND`)
  - 🎙️ **Singer / Vocal Team** (`SINGER` — Lead Vocal, Backing Vocals)
  - 🎸 **Band / Musician Team** (`MUSICIAN` — Acoustic Guitar, Electric Guitar, Bass, Keys/Piano, Drums, etc.)
- **Duplicate Registration Guard**: Prevents team members from double-booking identical roles or overwriting existing teammates, providing instant warnings.
- **Self-Service Updates**: Members can switch roles or cancel their registration with immediate feedback.

### ⚡ Admin Command Center (`/admin`)
- **Bird’s-Eye Overview**: Real-time counters for Total Services, Registered Members, and Role Assignments.
- **Event Scheduling**: Modal to add new services with custom titles, dates, start times, and descriptions.
- **Quick Roster Actions**: View full team breakdowns per service, add members on demand, or remove assignments.
- **Statistics & Table Views**: Dedicated tabs to analyze participation across teams and dates.

### 🔒 Modern Auth & User Profile
- **Authentication**: Email & Password credentials alongside Google OAuth 2.0 integration.
- **Custom Avatar Studio**: Upload and interactively crop profile avatars with `react-easy-crop`, stored securely in Supabase Storage.
- **Role-Based Access**: Automatic route guarding between standard `USER` members and `ADMIN` managers via stateless JWT cookies (`jose`).

### 🚀 Ultra-Fast Infrastructure & Co-location
- **Singapore Co-location**: Vercel Serverless Functions deployed in `sin1` (Singapore), co-located with Supabase PostgreSQL (`aws-0-ap-southeast-1`), slashing round-trip DB latency from ~300ms down to `< 10ms`.
- **Database Indexing**: Optimized B-Tree indexes on `services(date)` and `registrations(service_id, team, role_detail)`.
- **Stateless Session Re-use**: Elimination of redundant DB queries on page navigation by reading identity claims directly from cryptographically signed session cookies.

---

## 📸 Screenshots

<div align="center">

### 🗓️ Member Schedule & Upcoming Events View
<img src="./public/screenshots/schedule.png" alt="Worship Schedule Page" width="90%" style="border-radius: 8px; box-shadow: 5px 5px 0px #111111; border: 3px solid #111111;" />

<br/><br/>

### 🛠️ Admin Dashboard & Team Management
<img src="./public/screenshots/admin.png" alt="Admin Dashboard" width="90%" style="border-radius: 8px; box-shadow: 5px 5px 0px #111111; border: 3px solid #111111;" />

<br/><br/>

### 🔐 Neo-Brutalist Authentication Modal
<img src="./public/screenshots/login.png" alt="Authentication Modal" width="55%" style="border-radius: 8px; box-shadow: 5px 5px 0px #111111; border: 3px solid #111111;" />

</div>

---

## 🛠️ Tech Stack

| Domain | Technology | Description |
| :--- | :--- | :--- |
| **Framework** | [Next.js 16](https://nextjs.org/) | App Router, React Server Components (RSC), Server Actions |
| **UI Library** | [React 19](https://react.dev/) | Latest React concurrent primitives |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Modern utility styling with custom neo-brutalist theme |
| **Database** | [PostgreSQL (Supabase)](https://supabase.com/) | Cloud database with connection pooling and custom indexes |
| **Authentication** | [Jose JWT](https://github.com/panva/jose) & Google OAuth | Stateless HTTP-only cookie-based authentication |
| **File Storage** | [Supabase Storage](https://supabase.com/storage) | Bucket for profile pictures and media assets |
| **Date Utilities** | [date-fns v4](https://date-fns.org/) | High-speed, tree-shakable date manipulation |
| **Icons & UI** | [Lucide React](https://lucide.dev/), [Radix UI](https://www.radix-ui.com/) | Accessible primitives and crisp icons |
| **Notifications** | [Sonner](https://sonner.emilkowal.ski/) | Top-right neo-brutalist toast alerts |
| **Deployment** | [Vercel](https://vercel.com/) | Edge network and serverless functions (`sin1` region) |

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v20.x or higher
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)
- A [Supabase](https://supabase.com/) project with PostgreSQL database

### 2. Clone Repository
```bash
git clone https://github.com/TrucmaiUS/worship-team-scheduler.git
cd worship-team-scheduler
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment Variables
Create a `.env.local` file in the root directory:

```env
# Database (Supabase PostgreSQL Connection Pooler)
DATABASE_URL="postgresql://postgres.[project-id]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"

# Supabase API
NEXT_PUBLIC_SUPABASE_URL="https://[project-id].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# App & Auth
JWT_SECRET="your-strong-random-secret"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Google OAuth (Optional for local testing)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### 5. Run Development Server
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📂 Project Structure

```text
├── app/
│   ├── actions/           # Server Actions (auth, schedule, user)
│   ├── admin/             # Admin Dashboard & Statistics
│   ├── api/               # API routes (Google OAuth callback)
│   ├── login/             # Sign-in page
│   ├── profile/           # User profile & avatar upload
│   ├── register/          # Account registration
│   ├── schedule/          # Main worship calendar & event roster
│   ├── layout.tsx         # Root layout with Navbar & Toaster
│   └── page.tsx           # Neo-brutalist landing page
├── components/
│   ├── admin/             # Admin-specific modals & roster cards
│   ├── layout/            # Navbar, NavbarBrand, Footer
│   ├── schedule/          # ServiceCard, RoleModal, FilterBar
│   └── ui/                # Button, Avatar, Dialog, Badge primitives
├── lib/
│   ├── auth.ts            # JWT signing, verification, and cookie session
│   └── db.ts              # PostgreSQL Pool singleton for serverless
├── public/
│   ├── images/            # Static image assets & covers
│   └── screenshots/       # Visual showcase previews for README
├── vercel.json            # Deployment configuration (regions: ["sin1"])
├── next.config.ts         # Next.js 16 configuration
└── package.json           # Project manifest
```

---

## 🎨 Design Philosophy

This project embraces the **Neo-Brutalist** aesthetic inspired by modern music culture:
- **Bold Contours**: High-contrast `4px` black borders on cards, buttons, and inputs.
- **Offset Drop-Shadows**: Retro box shadows (`shadow-[4px_4px_0_0_#111111]`) that "press down" upon click.
- **Vibrant Accent Palette**: Energetic pops of `#FF6B8B` (Pink), `#0038FF` (Electric Blue), and `#FDFBF7` (Warm Cream).
- **Sticker Badges**: Playful, tactile status labels that make serving in church feel fun, engaging, and collaborative.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to open an issue or submit a Pull Request.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

<div align="center">
  <sub>Built with ❤️ for worship teams everywhere.</sub>
</div>
