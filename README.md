# Worship Ministry Platform

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-black?style=for-the-badge&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google_Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

</div>

**A high-performance Neo-Brutalist platform for church worship teams to coordinate service rosters, manage song catalogs, and curate Sunday setlists via disciplined Hybrid AI Search & RAG.**

![Worship Ministry Platform Cover](./public/screenshots/cover.png)

---

## Overview

**Worship Ministry Platform** combines a tactile Neo-Brutalist design with high-reliability backend engineering to solve two core ministry challenges:
- **Volunteer Coordination**: Conflict-free rostering across Sound, Vocals, and Band members with real-time availability.
- **Service Planning**: Automated `.docx` song ingestion, sub-100ms hybrid lexical/vector search, and intelligent Sunday setlist planning with pastoral transition prayers.

---

## How It Works

1. **Deterministic Ingestion & Indexing**: Ingests raw `.docx` song sheets using a zero-token Finite-State Automaton (FSA) parser to extract structured sections (Verse, Chorus, Bridge). Injects section-level metadata, enforces idempotent catalog updates via cryptographic SHA-256 deduplication, and stores 768-dimensional dense vector embeddings in PostgreSQL via `pgvector`.
2. **Hybrid Information Retrieval**: Dispatches search queries simultaneously across two independent channels: Sparse Lexical Retrieval (PostgreSQL Full-Text Search with custom GIN unaccent index) and Dense Semantic Retrieval (`pgvector` cosine similarity). Fuses candidate rankings using Reciprocal Rank Fusion (RRF, $k=60$) coupled with a two-stage cross-matching reranker for explainable lyric snippet attribution.
3. **Grounded Setlist Generation (RAG)**: Constrains song selection strictly to verified database candidates, completely eliminating model hallucination. Leverages Gemini 2.5 Flash with strict Zod structured outputs to construct a liturgical Sunday setlist (Opener $\to$ Worship $\to$ Response) alongside pastoral transition prayers and acoustic band dynamic cues.

For component-level specifications, mathematical models, and enterprise scaling strategies, see [AI Engineering Deep Dive](docs/AI_ENGINEERING_DEEP_DIVE.md) and [Search Architecture](docs/SEARCH_ENGINE_ARCHITECTURE.md).

---

## Key Features

- **Service Scheduling & Conflict-Free Rostering**: Interactive 30-day agenda and monthly calendar views. Automated cross-role conflict checks prevent volunteer double-booking across Sound, Vocals, and Band musicians with full admin management controls.
- **Automated Song Ingestion & Sheet Processing**: Batch import Word (`.docx`) chord sheets into structured digital formats with automatic section recognition (Verse/Chorus/Bridge), Unicode normalization, and duplicate suppression.
- **Theological & Lyric Hybrid Search**: Search songs instantly by title, artist, lyric snippet, or theological topic. Includes an interactive Search Playground (`/admin/songs/search`) featuring real-time score breakdowns and highlighted lyric evidence.
- **AI-Powered Sunday Setlist Curation**: Input a sermon topic and Scripture passage to generate a structured 3-song worship set (Opener, Worship, Response) complete with pastoral transition prayers and acoustic band dynamic coaching.

---

## Empirical Benchmark Suite (N=50)

Evaluated with 50 standardized queries across 4 behavioral categories (`scripts/benchmark.ts`):

| Retrieval Method | Hit@1 | Hit@3 | Hit@5 | MRR | NDCG@3 | NDCG@5 | Latency (Avg) | Latency (P95) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Baseline 1: Keyword (PostgreSQL FTS)** | 60.0% | 60.0% | 60.0% | 0.600 | 0.593 | 0.593 | 45.3 ms | 51.7 ms |
| **Baseline 2: Semantic (Gemini Cloud)** | 90.0% | 98.0% | 98.0% | 0.940 | 0.901 | 0.915 | 454.9 ms | 561.7 ms |
| **Baseline 3: Hybrid (RRF Cloud)** | **90.0%** | **98.0%** | **98.0%** | **0.940** | **0.901** | **0.915** | 468.2 ms | 607.7 ms |
| *Variant 2B: Semantic (Offline Local)* | 76.0% | 84.0% | 92.0% | 0.811 | 0.778 | 0.812 | 46.6 ms | 51.2 ms |
| *Variant 3B: Hybrid (Offline Local)* | 82.0% | 86.0% | 94.0% | 0.855 | 0.813 | 0.847 | 75.4 ms | 97.5 ms |

### Key Findings
- **Title/Artist Queries**: Keyword and Hybrid reach 100% Hit@3 (MRR 1.000).
- **Theological Concepts**: Keyword drops to 0% Hit@3 due to vocabulary mismatch, while Hybrid and Semantic achieve 100% Hit@3.
- **Hard Traps & Proper Nouns**: Hybrid acts as an error guard, achieving 87.5% Hit@3 where single-mode search drifts.

Detailed methodology and analysis: [docs/BENCHMARK_REPORT.md](docs/BENCHMARK_REPORT.md).

---

## Technical Documentation

- [AI Engineering Deep Dive (`docs/AI_ENGINEERING_DEEP_DIVE.md`)](docs/AI_ENGINEERING_DEEP_DIVE.md): In-depth dissection of parsing, chunking, vector scoring, RAG failure prevention, and scaling strategies.
- [Benchmark Report (`docs/BENCHMARK_REPORT.md`)](docs/BENCHMARK_REPORT.md): Complete evaluation dataset, test cases, and cloud vs. local latency breakdown.
- [Search Architecture Specification (`docs/SEARCH_ENGINE_ARCHITECTURE.md`)](docs/SEARCH_ENGINE_ARCHITECTURE.md): Database schemas, RRF implementation, and API contracts.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 16 (App Router, Server Actions), React 19, Tailwind CSS v4 |
| **UI Components** | Lucide React, Sonner, Neo-Brutalist design tokens |
| **Database & Vector** | PostgreSQL 16 (Supabase), pgvector extension, Node.js `pg` Pool |
| **AI & LLM** | Google Gemini 2.5 Flash, `text-embedding-004`, Zod schema enforcement |
| **Ingestion** | Mammoth, deterministic Regex finite-state parser |
| **Auth & Security** | Jose (HTTP-only JWT cookies), Google OAuth 2.0 |
| **Testing** | Vitest, 50-case automated retrieval benchmark runner |
| **Deployment** | Vercel (Singapore `sin1` region) |

---

## Repository Structure

```
.
├── app/
│   ├── actions/               # Server Actions (auth, mutations)
│   ├── admin/
│   │   ├── songs/             # Song catalog & imports
│   │   │   ├── search/        # AI Search Playground
│   │   │   └── setlist/       # AI Setlist Generator
│   │   └── page.tsx           # Admin roster management
│   ├── api/                   # Auth & search endpoints
│   ├── schedule/              # Public service scheduling
│   └── profile/               # User profile & avatar crop
├── components/                # Admin, layout, and UI components
├── docs/                      # Technical specs & benchmark reports
├── lib/
│   ├── ai/                    # RAG Setlist Generator & Zod schemas
│   ├── parser/                # Document parser & duplicate detector
│   ├── search/                # Keyword, Semantic, Hybrid RRF, Reranker
│   └── db.ts                  # Database connection pool
├── scripts/                   # Migrations, seeding, benchmark suite
└── vitest.config.mjs          # Unit testing configuration
```

---

## License

This project is licensed under the [MIT License](LICENSE).
