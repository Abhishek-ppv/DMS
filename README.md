# DealerFlow DMS - Enterprise Handset Dealer Management System

DealerFlow DMS is an enterprise-grade Dealer Management System tailored specifically for handset distribution and multi-tier retail networks (Suppliers, Distributors, Dealers, Direct Dealers).

## System Architecture Overview

- **Frontend**: React + TypeScript + Vite + Tailwind CSS (`apps/frontend`)
- **Backend**: NestJS + Express Adapter + REST API (`apps/backend`)
- **AI Microservice**: Python + FastAPI (`apps/ai-service`)
- **Database**: PostgreSQL with Prisma ORM (`database/prisma/schema.prisma`)
- **Cache**: Redis (`REDIS_URL`)

---

## Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL (v14+)
- Python (v3.10+)
- Redis

### Environment Setup

Copy `.env.example` to `.env` and adjust your environment variables:

```bash
cp .env.example .env
```

### Installation

Install all monorepo dependencies:

```bash
npm install
```

### Database Setup & Migrations

To apply database migrations and populate seed data:

```bash
# Run migrations from scratch
npm run migrate

# Seed database with initial roles, partners, catalog, and inventory
npm run seed
```

---

## Development Commands

| Task | Command | Description |
| --- | --- | --- |
| **Full Stack Dev** | `npm run dev` | Runs NestJS backend and Vite frontend concurrently |
| **Backend API** | `npm run start:backend` | Starts NestJS server on `http://localhost:3000` |
| **Frontend App** | `npm run start:frontend` | Starts Vite dev server on `http://localhost:5173` |
| **AI Microservice** | `npm run start:ai` | Starts FastAPI service on `http://localhost:8000` |
| **View Database GUI** | `npm run studio` | Launches Prisma Studio visual database editor on `http://localhost:5555` |
| **Migrate DB** | `npm run migrate` | Runs Prisma database migrations |
| **Seed DB** | `npm run seed` | Populates fresh database with initial dataset |
| **Build Project** | `npm run build` | Builds backend and frontend for production |

---

## Health Check Endpoints

- **NestJS Backend**: `GET http://localhost:3000/api/health`
  - Returns `{ "status": "ok", "service": "dealer-flow-dms", "database": "connected" }`
- **FastAPI AI Service**: `GET http://localhost:8000/health`
  - Returns `{ "status": "ok", "service": "dealer-flow-ai" }`
