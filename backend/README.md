# Backend - MBC Reservation API

RESTful API for the MBC Restaurant Reservation System, built with Node.js, Express, TypeScript, and Prisma ORM.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Available Scripts](#available-scripts)
- [Development Guidelines](#development-guidelines)
- [Troubleshooting](#troubleshooting)

## ✨ Features

- **RESTful API** with Express 5
- **Type-safe Database ORM** with Prisma
- **JWT Authentication** with access and refresh tokens
- **Real-time Updates** via Socket.IO
- **Email Notifications** using Resend service
- **Password Hashing** with bcrypt
- **CORS Support** for cross-origin requests
- **Session Management**
- **Database Migrations** with Prisma

## 🛠️ Tech Stack

- **Node.js** 20+ - JavaScript runtime
- **Express 5** - Web application framework
- **TypeScript** - Type safety and better developer experience
- **Prisma** - Next-generation ORM
- **PostgreSQL** - Relational database
- **Socket.IO** - Real-time bidirectional communication
- **JWT** (jsonwebtoken) - Secure authentication
- **bcrypt** - Password hashing
- **Resend** - Email delivery service
- **nodemailer** - Email sending library
- **cors** - Cross-origin resource sharing
- **dotenv** - Environment variable management

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 20.x ([Download](https://nodejs.org/))
- **npm** >= 9.x (comes with Node.js)
- **PostgreSQL** >= 15.x ([Download](https://www.postgresql.org/download/))
- **Git** ([Download](https://git-scm.com/downloads))

Optional:
- **Docker** and **Docker Compose** (for containerized development)

## 🚀 Installation

1. **Navigate to the backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Generate Prisma Client**
   ```bash
   npx prisma generate
   ```

## 🔐 Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/restaurant_db"

# JWT Secrets (use strong, random strings in production)
JWT_ACCESS_SECRET="your-super-secret-access-token-key"
JWT_REFRESH_SECRET="your-super-secret-refresh-token-key"

# Email Service (Resend)
RESEND_API_KEY="re_your_resend_api_key"
FROM_EMAIL="noreply@yourdomain.com"

# Server Configuration
PORT=3000
NODE_ENV=development

# Frontend URL (for CORS and email links)
FRONTEND_URL="http://localhost:5173"
```

### Getting API Keys

- **Resend API Key**: Sign up at [resend.com](https://resend.com) and get your API key
- **JWT Secrets**: Generate secure random strings using:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

## 🗄️ Database Setup

### Option 1: Using Docker

If you're using Docker Compose from the root directory, the PostgreSQL database is automatically set up.

### Option 2: Manual PostgreSQL Setup

1. **Install PostgreSQL** (if not already installed)

2. **Create the database**
   ```bash
   psql -U postgres
   CREATE DATABASE restaurant_db;
   \q
   ```

3. **Update DATABASE_URL** in `.env` with your credentials

### Running Migrations

Apply database migrations to create tables:

```bash
npx prisma migrate deploy
```

### Seeding the Database

Populate the database with initial data:

```bash
npm run seed
```

This will create:
- Default admin user
- Sample tables
- Sample bookings (optional)

### Prisma Studio (Database GUI)

To view and edit your database with a GUI:

```bash
npx prisma studio
```

This opens a web interface at `http://localhost:5555`

## 🏃 Running the Application

### Development Mode

Start the development server with hot-reload:

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### Production Mode

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Start the production server**
   ```bash
   npm start
   ```

### Using Docker

From the root directory:

```bash
docker-compose up backend
```

## 📡 API Documentation

### Base URL

```
http://localhost:3000/api
```

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}
```

### Booking Endpoints

#### Get All Bookings
```http
GET /api/bookings
Authorization: Bearer {accessToken}
```

#### Get Booking by ID
```http
GET /api/bookings/:id
Authorization: Bearer {accessToken}
```

#### Create Booking
```http
POST /api/bookings
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "language": "en",
  "size": 4,
  "startTime": "2024-03-20T19:00:00Z",
  "endTime": "2024-03-20T21:00:00Z",
  "tableIds": [1, 2]
}
```

#### Update Booking
```http
PUT /api/bookings/:id
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "status": "CONFIRMED"
}
```

#### Delete Booking
```http
DELETE /api/bookings/:id
Authorization: Bearer {accessToken}
```

### Table Endpoints

#### Get All Tables
```http
GET /api/tables
```

#### Get Table by ID
```http
GET /api/tables/:id
```

#### Create Table
```http
POST /api/tables
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name": "Table 1",
  "capacity": 4,
  "type": "RECTANGULAR",
  "x": 100,
  "y": 200
}
```

#### Update Table
```http
PUT /api/tables/:id
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "capacity": 6
}
```

#### Delete Table
```http
DELETE /api/tables/:id
Authorization: Bearer {accessToken}
```

### Real-time Events (Socket.IO)

Connect to Socket.IO at `http://localhost:3000`

#### Events

- `booking:created` - New booking created
- `booking:updated` - Booking status changed
- `booking:deleted` - Booking cancelled
- `table:updated` - Table configuration changed

## 📁 Project Structure

```
backend/
├── prisma/
│   ├── migrations/          # Database migration files
│   └── schema.prisma        # Prisma schema definition
├── src/
│   ├── controllers/         # Route controllers
│   │   ├── authController.ts
│   │   ├── bookingController.ts
│   │   └── tableController.ts
│   ├── middleware/          # Express middleware
│   │   ├── auth.ts         # JWT authentication
│   │   └── errorHandler.ts
│   ├── routes/             # API routes
│   │   ├── auth.ts
│   │   ├── bookings.ts
│   │   └── tables.ts
│   ├── services/           # Business logic
│   │   ├── authService.ts
│   │   ├── bookingService.ts
│   │   ├── emailService.ts
│   │   └── tableService.ts
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions
│   ├── lib/                # Third-party integrations
│   ├── seed.ts             # Database seeding script
│   └── server.ts           # Application entry point
├── .dockerignore           # Docker ignore file
├── .gitignore             # Git ignore file
├── Dockerfile             # Docker configuration
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── README.md             # This file
```

## 📜 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot-reload (nodemon) |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Start production server |
| `npm run seed` | Seed database with initial data |
| `npm test` | Run tests (to be implemented) |

### Prisma Scripts

| Command | Description |
|---------|-------------|
| `npx prisma generate` | Generate Prisma Client |
| `npx prisma migrate dev` | Create and apply migrations (dev) |
| `npx prisma migrate deploy` | Apply migrations (production) |
| `npx prisma studio` | Open Prisma Studio GUI |
| `npx prisma db push` | Push schema changes without migrations |
| `npx prisma db seed` | Run seed script |

## 👨‍💻 Development Guidelines

### Code Style

- Use **TypeScript** for all new files
- Follow **ESLint** rules (when configured)
- Use **async/await** for asynchronous operations
- Use **Prisma Client** for all database operations
- Follow **RESTful** API conventions

### Adding a New Endpoint

1. **Define the route** in `src/routes/`
2. **Create the controller** in `src/controllers/`
3. **Implement business logic** in `src/services/`
4. **Add middleware** if needed (auth, validation)
5. **Update API documentation** in this README

### Database Changes

1. **Update Prisma schema** in `prisma/schema.prisma`
2. **Create migration**:
   ```bash
   npx prisma migrate dev --name description_of_change
   ```
3. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```
4. **Update seed script** if necessary

### Git Workflow

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

3. Push and create a pull request:
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

## 🔍 Troubleshooting

### Port Already in Use

If port 3000 is already in use:

```bash
# Find and kill the process using port 3000
# On Linux/Mac:
lsof -ti:3000 | xargs kill -9

# On Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

Or change the PORT in your `.env` file.

### Database Connection Issues

1. **Check PostgreSQL is running**:
   ```bash
   # On Linux/Mac:
   sudo systemctl status postgresql
   
   # On Mac with Homebrew:
   brew services list
   ```

2. **Verify DATABASE_URL** in `.env` is correct

3. **Test connection**:
   ```bash
   psql "postgresql://username:password@localhost:5432/restaurant_db"
   ```

### Prisma Client Issues

If you encounter Prisma Client errors:

```bash
# Regenerate Prisma Client
npx prisma generate

# Reset database (WARNING: This deletes all data)
npx prisma migrate reset
```

### Module Not Found Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Compilation Errors

```bash
# Check TypeScript configuration
npx tsc --noEmit

# Rebuild
npm run build
```

## 🧪 Testing

To run tests (when implemented):

```bash
npm test
```

## 📚 Additional Resources

- [Express Documentation](https://expressjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Socket.IO Documentation](https://socket.io/docs/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

## 🤝 Contributing

1. Ensure your code follows the project's coding standards
2. Write clear commit messages
3. Update documentation for any new features
4. Test your changes thoroughly
5. Create a pull request with a detailed description

## 📄 License

ISC License

## 👥 Support

For questions or issues:
- Open an issue on GitHub
- Contact the development team
- Check existing documentation

---

**Happy Coding! 🚀**
