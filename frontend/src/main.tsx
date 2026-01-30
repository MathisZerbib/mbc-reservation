import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BookingsProvider } from './context/BookingsContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BookingsProvider>
      <App />
    </BookingsProvider>
  </StrictMode>,
)
