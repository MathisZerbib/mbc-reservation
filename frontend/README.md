# Frontend - MBC Reservation System

Modern, responsive React application for restaurant reservation management, built with React 19, TypeScript, Vite, and TailwindCSS.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [Building for Production](#building-for-production)
- [Project Structure](#project-structure)
- [Available Scripts](#available-scripts)
- [Component Library](#component-library)
- [Development Guidelines](#development-guidelines)
- [Troubleshooting](#troubleshooting)

## ✨ Features

- **Modern UI** with React 19 and TypeScript
- **Real-time Updates** via Socket.IO
- **Responsive Design** with TailwindCSS
- **Multi-language Support** (i18n)
- **Interactive Animations** with Framer Motion
- **Accessible Components** using Radix UI
- **Form Validation** with custom hooks
- **Date Picker** for booking management
- **PWA Support** with offline capabilities
- **Client-side Routing** with React Router
- **Bot Protection** with Turnstile

## 🛠️ Tech Stack

- **React 19** - Latest React with concurrent features
- **TypeScript** - Type-safe development
- **Vite 7** - Lightning-fast build tool
- **TailwindCSS 4** - Utility-first CSS framework
- **React Router 7** - Client-side routing
- **Socket.IO Client** - Real-time communication
- **Framer Motion** - Smooth animations
- **Radix UI** - Accessible component primitives
- **Lucide React** - Beautiful icon library
- **date-fns / dayjs** - Date manipulation
- **React Day Picker** - Date picker component
- **Vite PWA** - Progressive Web App support

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 20.x ([Download](https://nodejs.org/))
- **npm** >= 9.x (comes with Node.js)
- **Git** ([Download](https://git-scm.com/downloads))

Optional:
- **Docker** and **Docker Compose** (for containerized development)

## 🚀 Installation

1. **Navigate to the frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file**
   ```bash
   cp .env.example .env
   ```

4. **Update environment variables** in `.env` (see below)

## 🔐 Environment Variables

Create a `.env` file in the `frontend` directory with the following variables:

```env
# API Configuration
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000

# Turnstile (Cloudflare bot protection) - Optional
VITE_TURNSTILE_SITE_KEY=your_turnstile_site_key

# Application Settings
VITE_APP_NAME=MBC Reservation
VITE_DEFAULT_LANGUAGE=en
```

### Getting API Keys

- **Turnstile Site Key**: Sign up at [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) (optional for bot protection)

## 🏃 Running the Application

### Development Mode

Start the development server with hot module replacement (HMR):

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

The dev server features:
- ⚡️ Instant hot module replacement
- 🔍 Source maps for easy debugging
- 🚀 Fast refresh for React components

### Production Preview

Build and preview the production bundle locally:

```bash
npm run build
npm run preview
```

The preview server will start at `http://localhost:4173`

### Using Docker

From the root directory:

```bash
docker-compose up frontend
```

## 📦 Building for Production

1. **Build the application**
   ```bash
   npm run build
   ```

   This creates an optimized production build in the `dist/` directory with:
   - Minified JavaScript and CSS
   - Code splitting for optimal loading
   - Asset optimization
   - Source maps for debugging

2. **Test the production build locally**
   ```bash
   npm run preview
   ```

3. **Deploy the `dist/` folder** to your hosting service (Vercel, Netlify, etc.)

### Build Optimization

The production build includes:
- Tree-shaking to remove unused code
- Code splitting for better performance
- Asset compression (images, fonts)
- CSS optimization with TailwindCSS

## 📁 Project Structure

```
frontend/
├── public/                 # Static assets
│   ├── favicon.ico
│   └── manifest.json      # PWA manifest
├── src/
│   ├── assets/            # Images, fonts, etc.
│   ├── components/        # React components
│   │   ├── ui/           # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Dialog.tsx
│   │   │   └── ...
│   │   ├── layout/       # Layout components
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── booking/      # Booking-specific components
│   │   └── tables/       # Table management components
│   ├── context/          # React Context providers
│   │   ├── AuthContext.tsx
│   │   └── SocketContext.tsx
│   ├── hooks/            # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useBookings.ts
│   │   └── useTables.ts
│   ├── i18n/             # Internationalization
│   │   ├── en.ts
│   │   ├── fr.ts
│   │   └── index.ts
│   ├── lib/              # Third-party library configs
│   │   └── utils.ts
│   ├── services/         # API service layer
│   │   ├── api.ts
│   │   ├── authService.ts
│   │   ├── bookingService.ts
│   │   └── socketService.ts
│   ├── types/            # TypeScript type definitions
│   │   ├── booking.ts
│   │   ├── table.ts
│   │   └── user.ts
│   ├── utils/            # Utility functions
│   │   ├── formatters.ts
│   │   └── validators.ts
│   ├── App.tsx           # Main App component
│   ├── App.css           # App-specific styles
│   ├── main.tsx          # Application entry point
│   └── index.css         # Global styles
├── .gitignore            # Git ignore file
├── .dockerignore         # Docker ignore file
├── Dockerfile            # Docker configuration
├── eslint.config.js      # ESLint configuration
├── index.html            # HTML template
├── package.json          # Dependencies and scripts
├── postcss.config.js     # PostCSS configuration
├── tailwind.config.js    # TailwindCSS configuration
├── tsconfig.json         # TypeScript configuration
├── tsconfig.app.json     # App TypeScript config
├── tsconfig.node.json    # Node TypeScript config
├── vite.config.ts        # Vite configuration
└── README.md            # This file
```

## 📜 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server on port 5173 |
| `npm run build` | Build production bundle to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Lint code with ESLint |

## 🎨 Component Library

### UI Components (Radix UI + Custom)

Located in `src/components/ui/`:

- **Button** - Various button styles and variants
- **Card** - Content containers with header, content, footer
- **Dialog** - Modal dialogs for forms and confirmations
- **Popover** - Floating content for menus and tooltips
- **Input** - Form input fields with validation
- **Select** - Dropdown selection components
- **DatePicker** - Date selection with calendar
- **Toast** - Notification system

### Usage Example

```tsx
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

function MyComponent() {
  return (
    <Card>
      <Card.Header>
        <h2>Booking Details</h2>
      </Card.Header>
      <Card.Content>
        <p>Your reservation information</p>
      </Card.Content>
      <Card.Footer>
        <Button variant="primary" size="lg">
          Confirm Booking
        </Button>
      </Card.Footer>
    </Card>
  )
}
```

## 🎨 Styling with TailwindCSS

This project uses TailwindCSS 4 for styling:

```tsx
// Using Tailwind utility classes
<div className="flex items-center gap-4 p-6 bg-white rounded-lg shadow-md">
  <h1 className="text-2xl font-bold text-gray-900">Hello</h1>
</div>
```

### Custom Utilities

Additional utilities are defined in `src/lib/utils.ts`:

```ts
import { cn } from '@/lib/utils'

// Combine class names with conditional logic
<div className={cn(
  "base-class",
  isActive && "active-class",
  hasError && "error-class"
)} />
```

## 🌐 Internationalization (i18n)

The app supports multiple languages. Translation files are in `src/i18n/`:

```tsx
import { useTranslation } from '@/hooks/useTranslation'

function MyComponent() {
  const { t } = useTranslation()
  
  return (
    <h1>{t('welcome.title')}</h1>
  )
}
```

### Adding a New Language

1. Create a new file in `src/i18n/` (e.g., `es.ts`)
2. Export translations with the same structure as `en.ts`
3. Import and add to the i18n configuration

## 🔌 Real-time Communication

Socket.IO is used for real-time updates:

```tsx
import { useSocket } from '@/hooks/useSocket'

function BookingList() {
  const socket = useSocket()
  
  useEffect(() => {
    socket.on('booking:created', (booking) => {
      // Handle new booking
    })
    
    return () => {
      socket.off('booking:created')
    }
  }, [socket])
}
```

## 👨‍💻 Development Guidelines

### Code Style

- Use **TypeScript** for type safety
- Follow **ESLint** rules (run `npm run lint`)
- Use **functional components** with hooks
- Keep components **small and focused**
- Use **custom hooks** for shared logic
- Follow **React best practices**

### Component Guidelines

1. **One component per file** (except for closely related sub-components)
2. **Export components as named exports**
3. **Use TypeScript interfaces** for props
4. **Add JSDoc comments** for complex components
5. **Keep state close to where it's used**

### Creating a New Component

```tsx
// src/components/MyComponent.tsx
import React from 'react'

interface MyComponentProps {
  title: string
  onAction: () => void
}

/**
 * MyComponent - Brief description
 * @param title - The component title
 * @param onAction - Callback when action is triggered
 */
export function MyComponent({ title, onAction }: MyComponentProps) {
  return (
    <div>
      <h2>{title}</h2>
      <button onClick={onAction}>Click me</button>
    </div>
  )
}
```

### State Management

- **Local state**: Use `useState` for component-specific state
- **Shared state**: Use Context API (see `src/context/`)
- **Server state**: Use custom hooks with API calls

### API Integration

API calls are centralized in `src/services/`:

```tsx
// src/services/bookingService.ts
import { api } from './api'

export const bookingService = {
  getAll: () => api.get('/bookings'),
  getById: (id: string) => api.get(`/bookings/${id}`),
  create: (data: CreateBookingDTO) => api.post('/bookings', data),
  update: (id: string, data: UpdateBookingDTO) => api.put(`/bookings/${id}`, data),
  delete: (id: string) => api.delete(`/bookings/${id}`)
}
```

### Git Workflow

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and test thoroughly

3. Run linting before committing:
   ```bash
   npm run lint
   ```

4. Commit with descriptive messages:
   ```bash
   git commit -m "feat: add booking confirmation dialog"
   ```

5. Push and create a pull request:
   ```bash
   git push origin feature/your-feature-name
   ```

## 🔍 Troubleshooting

### Port Already in Use

If port 5173 is in use:

```bash
# Kill the process
# On Linux/Mac:
lsof -ti:5173 | xargs kill -9

# On Windows:
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

Or use a different port:
```bash
npm run dev -- --port 3001
```

### Module Not Found Errors

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Build Errors

```bash
# Clean build and rebuild
rm -rf dist
npm run build
```

### TypeScript Errors

```bash
# Check types without building
npx tsc --noEmit
```

### CORS Issues

Ensure your backend allows requests from `http://localhost:5173`:

```js
// In backend CORS configuration
cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
})
```

## 🧪 Testing

Testing infrastructure to be added. Recommended tools:

- **Vitest** - Fast unit testing
- **React Testing Library** - Component testing
- **Playwright** - E2E testing

## 📚 Additional Resources

- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Vite Documentation](https://vitejs.dev/)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [React Router Documentation](https://reactrouter.com/)
- [Radix UI Documentation](https://www.radix-ui.com/)

## 🤝 Contributing

1. Follow the code style guidelines
2. Write meaningful commit messages
3. Test your changes thoroughly
4. Update documentation as needed
5. Create pull requests with detailed descriptions

## 📄 License

ISC License

## 👥 Support

For questions or issues:
- Open an issue on GitHub
- Contact the development team
- Check the documentation

---

**Happy Coding! 🚀**
