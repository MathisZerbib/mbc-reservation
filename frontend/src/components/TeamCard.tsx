import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Users, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { useTranslation } from '../i18n/useTranslation';
import { cn } from '../lib/utils';

interface TeamUser {
    id: string;
    email: string;
    role: string;
    createdAt: string;
}

/** Owner-only team management: list staff, invite (email + password), remove. */
export const TeamCard: React.FC<{ flash: (kind: 'ok' | 'err', text: string) => void }> = ({ flash }) => {
    const { t } = useTranslation();
    const [users, setUsers] = useState<TeamUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [adding, setAdding] = useState(false);

    const load = useCallback(async () => {
        try {
            setUsers(await api.getUsers());
        } catch (e) {
            flash('err', e instanceof Error ? e.message : t('settings.saveFailed'));
        } finally {
            setLoading(false);
        }
    }, [flash, t]);

    useEffect(() => {
        void load();
    }, [load]);

    const add = async () => {
        if (!email.trim() || password.length < 12) {
            flash('err', t('team.inviteError'));
            return;
        }
        setAdding(true);
        try {
            await api.createUser({ email: email.trim(), password, role: 'STAFF' });
            setEmail('');
            setPassword('');
            await load();
            flash('ok', t('team.invited'));
        } catch (e) {
            flash('err', e instanceof Error ? e.message : t('settings.saveFailed'));
        } finally {
            setAdding(false);
        }
    };

    const remove = async (id: string) => {
        if (!window.confirm(t('team.removeConfirm'))) return;
        try {
            await api.deleteUser(id);
            await load();
            flash('ok', t('team.removed'));
        } catch (e) {
            flash('err', e instanceof Error ? e.message : t('settings.saveFailed'));
        }
    };

    return (
        <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-xl shadow-slate-200/50">
            <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">{t('team.title')}</h2>
            </div>
            <p className="text-xs text-slate-500 font-medium mb-4">{t('team.msg')}</p>
            {loading ? (
                <div className="h-11 w-full bg-slate-100 rounded-xl animate-pulse" />
            ) : (
                <div className="flex flex-col gap-2">
                    {users.map(u => (
                        <div key={u.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                            <span className="text-sm font-bold text-slate-900 truncate flex-1 min-w-0">{u.email}</span>
                            <span className={cn(
                                "text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg shrink-0",
                                u.role === 'OWNER' ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-600",
                            )}>
                                {u.role === 'OWNER' ? t('team.owner') : t('team.staff')}
                            </span>
                            <button
                                onClick={() => remove(u.id)}
                                aria-label={t('team.remove')}
                                className="p-2 text-slate-400 hover:text-red-600 transition-colors cursor-pointer shrink-0"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    <div className="flex flex-col sm:flex-row gap-2 mt-1">
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder={t('team.emailPh')}
                            className="flex-1 min-h-[48px] bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder={t('team.passwordPh')}
                            autoComplete="new-password"
                            className="flex-1 min-h-[48px] bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                        <button
                            onClick={add}
                            disabled={adding}
                            className="min-h-[48px] bg-slate-900 hover:bg-slate-800 text-white px-5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                        >
                            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            {t('team.invite')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
