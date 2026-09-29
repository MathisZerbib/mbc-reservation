import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';

export function ProtectedRoutes() {
    const navigate = useNavigate();
    const location = useLocation();
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const [allowed, setAllowed] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }
        const checkAuth = async () => {
            try {
                const res = await fetch(`${apiUrl}/protected`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) throw new Error();
                // Onboarding gate: fresh tenants complete setup before the app.
                const me = await fetch(`${apiUrl}/tenants/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (me.ok) {
                    const tenant = await me.json();
                    const onOnboarding = location.pathname === '/onboarding';
                    if (!tenant.onboardingComplete && !onOnboarding) {
                        navigate('/onboarding');
                        return;
                    }
                    if (tenant.onboardingComplete && onOnboarding) {
                        navigate('/admin/dashboard');
                        return;
                    }
                }
                setAllowed(true);
            } catch {
                localStorage.removeItem('token');
                navigate('/login');
            }
        };
        checkAuth();
    }, [navigate, apiUrl, location.pathname]);

    if (!allowed) return null;
    return <Outlet />;
}
