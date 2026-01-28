import { Resend } from 'resend';
import dayjs from 'dayjs';

const resend = new Resend(process.env.RESEND_API_KEY);

const APP_NAME = 'MBC Restaurant';
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';
const GOOGLE_MAPS_REVIEW_URL = 'https://goo.gl/maps/example'; // TODO: Replace with actual link

export const emailService = {
    sendConfirmationEmail: async (booking: any) => {
        // Skip if no email provided
        if (!booking.guestEmail) {
            console.log('No email provided for booking, skipping confirmation email');
            return;
        }

        const date = dayjs(booking.startTime).format('MMMM D, YYYY');
        const time = dayjs(booking.startTime).format('HH:mm');

        if (!process.env.RESEND_API_KEY) {
            console.log('--- MOCK EMAIL SENDING (No Resend API key) ---');
            console.log('To:', booking.guestEmail);
            console.log('Subject:', `Reservation Confirmed - ${APP_NAME}`);
            console.log('Date:', date);
            console.log('Time:', time);
            console.log('Guests:', booking.size);
            console.log('---------------------------------------------');
            return;
        }

        try {
            await resend.emails.send({
                from: `${APP_NAME} <${FROM_EMAIL}>`,
                to: booking.guestEmail,
                subject: `Reservation Confirmed - ${APP_NAME}`,
                html: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <h2 style="color: #4f46e5;">Welcome, ${booking.guestName}!</h2>
                        <p>Your reservation at <strong>${APP_NAME}</strong> has been successfully confirmed.</p>
                        <div style="background: #f3f4f6; padding: 20px; border-radius: 10px; margin: 20px 0;">
                            <p style="margin: 0;"><strong>Date:</strong> ${date}</p>
                            <p style="margin: 0;"><strong>Time:</strong> ${time}</p>
                            <p style="margin: 0;"><strong>Guests:</strong> ${booking.size} people</p>
                        </div>
                        <p>We look forward to seeing you!</p>
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
                        <p style="font-size: 12px; color: #6b7280;">If you need to cancel or modify your reservation, please contact us directly.</p>
                    </div>
                `,
            });
            console.log(`Confirmation email sent to ${booking.guestEmail}`);
        } catch (error) {
            console.error('Failed to send confirmation email:', error);
        }
    },

    sendFeedbackEmail: async (booking: any) => {
        // Skip if no email provided
        if (!booking.guestEmail) {
            console.log('No email provided for booking, skipping feedback email');
            return;
        }

        if (!process.env.RESEND_API_KEY) {
            console.log('--- MOCK FEEDBACK EMAIL (No Resend API key) ---');
            console.log('To:', booking.guestEmail);
            console.log('Subject:', `How was your visit to ${APP_NAME}?`);
            console.log('----------------------------------------------');
            return;
        }

        try {
            await resend.emails.send({
                from: `${APP_NAME} <${FROM_EMAIL}>`,
                to: booking.guestEmail,
                subject: `How was your visit to ${APP_NAME}?`,
                html: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; text-align: center;">
                        <h2 style="color: #4f46e5;">We'd Love Your Feedback!</h2>
                        <p>Hi ${booking.guestName}, thank you for visiting us recently.</p>
                        <p>We hope you had a wonderful experience. Would you mind taking a moment to leave us a review on Google Maps?</p>
                        <div style="margin: 30px 0;">
                            <a href="${GOOGLE_MAPS_REVIEW_URL}" style="background: #4f46e5; color: white; padding: 15px 30px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px;">
                                Review us on Google Maps
                            </a>
                        </div>
                        <p>Your feedback helps us grow and serve you better.</p>
                        <p>Best regards,<br/>The ${APP_NAME} Team</p>
                    </div>
                `,
            });
            console.log(`Feedback email sent to ${booking.guestEmail}`);
        } catch (error) {
            console.error('Failed to send feedback email:', error);
        }
    }
};
