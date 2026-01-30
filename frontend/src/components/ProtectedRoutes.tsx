import { useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';

export function ProtectedRoutes() {
  const navigate = useNavigate();
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/admin');
    fetch('/api/protected', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error();
      })
      .catch(() => {
        localStorage.removeItem('token');
        navigate('/admin');
      });
  }, [navigate]);
  return <Outlet />;
}