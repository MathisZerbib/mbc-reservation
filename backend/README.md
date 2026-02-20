# MBC Reservation Backend System

![Status](https://img.shields.io/badge/status-active-success.svg)
![Node](https://img.shields.io/badge/node-20%2B-blue.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.x-blue.svg)
![Express](https://img.shields.io/badge/express-4.x-lightgrey.svg)
![Prisma](https://img.shields.io/badge/prisma-5.x-blueviolet.svg)
![Docker](https://img.shields.io/badge/docker-containerized-2496ED.svg)

Access the high-performance, scalable backend API for the MBC Reservation system. This service manages restaurant table bookings, floor plan configurations, and real-time updates via WebSockets.

## 🏗 System Architecture

The backend follows a **Layered Architecture** (Controller-Service-Data Access) to ensure separation of concerns, testability, and maintainability.

- **Controllers** (`src/controllers`): Handle HTTP requests, input validation, and response formatting.
- **Services** (`src/services`): Contain pure business logic (booking rules, conflict detection, email dispatch).
- **Data Access** (`src/lib/prisma.ts`): Managed via **Prisma ORM** for type-safe database interactions.
- **Real-time Layer**: **Socket.IO** integration for broadcasting booking updates to connected clients immediately.

### Key Features
- **Stateless Authentication**: robust JWT implementation with refresh token rotation strategies.
- **Concurrency Management**: Transactional integrity for table reservations using Prisma transactions.
- **Real-time Events**: WebSocket events for live dashboard updates (e.g., new bookings).
- **Automated Testing**: Integration and unit tests via **Vitest**.

## 🚀 Getting Started

### Prerequisites

Ensure your development environment meets the following requirements:
- **Node.js** v20.x or higher
- **Docker** & **Docker Compose**
- **PostgreSQL** 15+ (or use the Docker container)

### 1. Installation

Clone the repository and install dependencies:

```bash
cd backend
npm install
```

### 2. Environment Configuration

Create a `.env` file in the `backend` root. Use the template below:

```ini
# Server Configuration
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Database Connection (PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/mbc_reservation?schema=public"

# Authentication (JWT Secrets - use strong generated strings)
JWT_ACCESS_SECRET="your-super-secret-access-key"
JWT_REFRESH_SECRET="your-super-secret-refresh-key"

# Email Service (Resend)
RESEND_API_KEY="re_123456789"
```

### 3. Database Setup

We use **Prisma** for schema management. Run the following to initialize your database:

```bash
# Generate Prisma client
npx prisma generate

# Run migrations to create tables
npx prisma migrate dev

# Seed the database with initial admin user and settings
npm run seed
```

### 4. Running the Application

**Development Mode** (with hot-reload):
```bash
npm run dev
```

**Production Build**:
```bash
npm run build
npm start
```

**Run via Docker**:
```bash
# From the project root
docker compose up --build backend
```

## 🛠 Project Structure

```
backend/src/
├── controllers/    # Request handlers (Auth, Booking, Table)
├── lib/            # Shared libraries (Prisma Client, utils)
├── middleware/     # Express middleware (Auth, Error handling)
├── routes/         # API Route definitions
├── scripts/        # Utility scripts (Seeding, Maintenance)
├── services/       # Business logic layer
└── utils/          # Helpers (JWT, Hashing, Validation)
```

## 🧪 Testing

We use **Vitest** for high-speed unit and integration testing.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test -- --watch
```

## 📅 Reservation Filler CLI

A utility script to bulk-create bookings for testing and demo purposes. Supports both an **interactive menu** and **one-liner commands** via CLI arguments.

### Interactive mode

```bash
docker compose exec backend npm run full-book
```

Walks you through mode selection, date/time, table picking, and confirmation prompts.

### Non-interactive mode

Pass all options as `--` flags to skip prompts entirely.

**Mode 1 — Full Book** (fill all tables for a time slot):
```bash
docker compose exec backend npm run full-book -- --mode 1 --date 2026-02-20 --time 16:30 --empty 2 --yes
```

**Mode 2 — Consecutive Book** (book specific tables for N consecutive slots):
```bash
docker compose exec backend npm run full-book -- --mode 2 --date 2026-02-20 --time 16:30 --tables 1,10,11 --count 3 --name "VIP" --yes
```

**Mode 3 — Full Book + Consecutive** (fill all tables AND add extra consecutive slots on specific tables):
```bash
docker compose exec backend npm run full-book -- --mode 3 --date 2026-02-20 --time 16:30 --empty 2 --tables 1,10,11,12,7,4,2 --extra 3 --name "Auto-Consec" --yes
```

### Available flags

| Flag | Description | Default | Modes |
|------|-------------|---------|-------|
| `--mode` | `1`, `2`, or `3` (**required**) | — | all |
| `--date` | Date in `YYYY-MM-DD` format | today | all |
| `--time` | Time in `HH:mm` format | `19:00` | all |
| `--empty` | Number of tables to leave empty | `0` | 1, 3 |
| `--tables` | Comma-separated table names (e.g. `1,10,11`) | — | 2, 3 |
| `--count` | Number of consecutive slots per table | `2` | 2 |
| `--extra` | Number of extra consecutive slots (on top of full book) | `1` | 3 |
| `--name` | Guest name prefix for bookings | `Auto-Consec` | 2, 3 |
| `--yes` | Skip the confirmation prompt | asks `y/n` | all |

> **Note:** Without `--yes`, the script will still pause for a `y/n` confirmation before executing.

## 🔌 API Documentation

### Bookings
- `GET /api/bookings`: Retrieve bookings (Supports filtering).
- `POST /api/bookings`: Create a new reservation.
- `GET /api/availability`: Check table availability for a specific time slot.
- `PATCH /api/bookings/:id/tables`: Assign or move a booking to a table.
- `POST /api/bookings/:id/check-in`: Mark a guest as arrived.

### Authentication
- `POST /api/auth/register`: Register a new admin.
- `POST /api/auth/login`: Authenticate and receive tokens.
- `POST /api/auth/refresh-token`: Rotate access tokens.

### Real-time Events (Socket.IO)
- `booking:created`: Emitted when a new booking is made.
- `booking:updated`: Emitted when booking status changes.

## 📦 Deployment

The application is containerized using Docker. Partitioning is handled via Multi-stage builds in the `Dockerfile` for optimized image size.

```bash
# Build the image
docker build -t mbc-backend .

# Run container
docker run -p 3000:3000 --env-file .env mbc-backend
```

---

_Maintained by the MBC Reservation Engineering Team._
