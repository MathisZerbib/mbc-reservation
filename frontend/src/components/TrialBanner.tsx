import React from 'react';
import { Clock, Lock } from 'lucide-react';
import { useTenant } from '../hooks/useFloorPlan';
import { useTranslation } from '../i18n/useTranslation';

/** Trial status banner: countdown while active, lock notice once expired. */
export const TrialBanner: React.FC = () => {
    const { tenant } = useTenant();
    const { t } = useTranslation();
    if (!tenant) return null;

    const daysLeft = Math.ceil((new Date(tenant.trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));

    if (tenant.trialActive) {
        if (daysLeft > 3) return null;
        return (
            <div className="flex-none flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-2xl shadow-sm">
                <Clock className="w-4 h-4 shrink-0" />
                <span className="text-xs font-bold">
                    {daysLeft <= 1 ? t('trial.endsOne') : t('trial.endsMany').replace('{n}', String(daysLeft))}
                </span>
            </div>
        );
    }

    return (
        <div className="flex-none flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-2xl shadow-sm">
            <Lock className="w-4 h-4 shrink-0" />
            <span className="text-xs font-bold">{t('trial.expired')}</span>
        </div>
    );
};
