# MBC Reservation System

A modern, full-stack restaurant reservation management system built with React, TypeScript, Node.js, Express, and PostgreSQL.

## 🌟 Features

- **Real-time Reservations**: Live booking system with real-time updates via Socket.IO
- **Table Management**: Visual table layout and capacity management
- **Multi-language Support**: Internationalization support for multiple languages
- **Authentication**: Secure JWT-based authentication system
- **Email Notifications**: Automated email confirmations via Resend
- **Admin Dashboard**: Manage bookings, tables, and reservations
- **Responsive Design**: Mobile-friendly interface with TailwindCSS

## 🏗️ Architecture

This project follows a monorepo structure with separate frontend and backend applications:

```
mbc-reservation/
├── frontend/          # React + TypeScript + Vite application
├── backend/           # Node.js + Express + Prisma API
├── docker-compose.yml # Docker orchestration for all services
└── README.md         # This file
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 20.x
- **npm** >= 9.x
- **Docker** and **Docker Compose** (optional, but recommended)
- **PostgreSQL** 15+ (if not using Docker)

### Option 1: Using Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/MathisZerbib/mbc-reservation.git
   cd mbc-reservation
   ```

2. **Configure environment variables**
   - Copy the example env files and update them with your values:
     ```bash
     cp backend/.env.example backend/.env
     cp frontend/.env.example frontend/.env
     ```

3. **Start all services**
   ```bash
   docker-compose up
   ```

4. **Access the applications**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - PostgreSQL: localhost:5432

### Option 2: Manual Setup

If you prefer to run the services individually without Docker:

1. **Set up the database**
   - Install PostgreSQL 15+
   - Create a database named `restaurant_db`

2. **Set up the Backend**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your database credentials
   npx prisma migrate deploy
   npx prisma generate
   npm run seed
   npm run dev
   ```

3. **Set up the Frontend**
   ```bash
   cd frontend
   npm install
   cp .env.example .env
   # Edit .env with your API URL
   npm run dev
   ```

## 📚 Documentation

- [Backend Documentation](./backend/README.md) - API, database schema, and backend setup
- [Frontend Documentation](./frontend/README.md) - UI components, routing, and frontend setup

## 🛠️ Tech Stack

### Frontend
- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **TailwindCSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **Socket.IO Client** - Real-time communication
- **Framer Motion** - Animations
- **Radix UI** - Accessible UI components

### Backend
- **Node.js** - Runtime environment
- **Express 5** - Web framework
- **TypeScript** - Type safety
- **Prisma** - ORM for PostgreSQL
- **PostgreSQL** - Database
- **Socket.IO** - Real-time communication
- **JWT** - Authentication
- **Resend** - Email service
- **bcrypt** - Password hashing

## 🔧 Development Workflow

### For Two Developers

This project is designed for collaborative development. Here's a recommended workflow:

1. **Create Feature Branches**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Keep Branches Up to Date**
   ```bash
   git fetch origin
   git rebase origin/main
   ```

3. **Run Tests Before Committing** (when available)
   ```bash
   # In backend
   npm test
   
   # In frontend
   npm run lint
   ```

4. **Create Pull Requests**
   - Push your branch and create a PR on GitHub
   - Request review from your teammate
   - Address feedback and merge

### Recommended Development Tools

- **VS Code** with extensions:
  - ESLint
  - Prettier
  - Prisma
  - Tailwind CSS IntelliSense
- **Postman** or **Thunder Client** for API testing
- **PostgreSQL Client** (pgAdmin, DBeaver, or TablePlus)

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend linting
cd frontend
npm run lint
```

## 📦 Building for Production

### Using Docker

```bash
docker-compose -f docker-compose.prod.yml up --build
```

### Manual Build

**Backend:**
```bash
cd backend
npm run build
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
npm run preview
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 Environment Variables

Both frontend and backend require environment variables. See the respective README files:
- [Backend Environment Variables](./backend/README.md#environment-variables)
- [Frontend Environment Variables](./frontend/README.md#environment-variables)

## 📄 License

This project is licensed under the ISC License.

## 👥 Authors

- [MathisZerbib](https://github.com/MathisZerbib)

## 🐛 Known Issues

- None at the moment

## 📧 Support

For support, please open an issue on GitHub or contact the maintainers.
