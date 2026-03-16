import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export const RESTAURANT_TZ = 'Europe/Paris';

/**
 * Parses a date or string in the restaurant's timezone.
 */
export const tz = (date?: string | number | Date | dayjs.Dayjs) => {
    return dayjs(date).tz(RESTAURANT_TZ);
};

/**
 * Formats a date or string according to the restaurant's timezone.
 */
export const formatInTZ = (date: string | Date | dayjs.Dayjs, format: string) => {
    return dayjs(date).tz(RESTAURANT_TZ).format(format);
};

export default dayjs;
