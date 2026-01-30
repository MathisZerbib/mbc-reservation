import { useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';

export function ProtectedRoutes() {
    const navigate = useNavigate();
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/');
    fetch(`${apiUrl}/protected`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error();
      })
      .catch(() => {
        localStorage.removeItem('token');
        navigate('/');
      });
  }, [navigate]);
  return <Outlet />;
}