import nodemailer from 'nodemailer';
import dayjs from 'dayjs';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const APP_NAME = 'MBC Restaurant';
const GOOGLE_MAPS_REVIEW_URL = 'https://goo.gl/maps/example'; // TODO: Replace with actual link

export const emailService = {
    sendConfirmationEmail: async (booking: any) => {
        const date = dayjs(booking.startTime).format('MMMM D, YYYY');
        const time = dayjs(booking.startTime).format('HH:mm');

        const mailOptions = {
            from: `"${APP_NAME}" <${process.env.SMTP_FROM || 'no-reply@mbc-restaurant.com'}>`,
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
        };

        if (!process.env.SMTP_USER) {
            console.log('--- MOCK EMAIL SENSING (No SMTP credentials) ---');
            console.log('To:', booking.guestEmail);
            console.log('Subject:', mailOptions.subject);
            console.log('Content:', mailOptions.html);
            console.log('-----------------------------------------------');
            return;
        }

        try {
            await transporter.sendMail(mailOptions);
            console.log(`Confirmation email sent to ${booking.guestEmail}`);
        } catch (error) {
            console.error('Failed to send confirmation email:', error);
        }
    },

    sendFeedbackEmail: async (booking: any) => {
        const mailOptions = {
            from: `"${APP_NAME}" <${process.env.SMTP_FROM || 'no-reply@mbc-restaurant.com'}>`,
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
        };

        if (!process.env.SMTP_USER) {
            console.log('--- MOCK FEEDBACK EMAIL (No SMTP credentials) ---');
            console.log('To:', booking.guestEmail);
            console.log('Subject:', mailOptions.subject);
            console.log('Content:', mailOptions.html);
            console.log('------------------------------------------------');
            return;
        }

        try {
            await transporter.sendMail(mailOptions);
            console.log(`Feedback email sent to ${booking.guestEmail}`);
        } catch (error) {
            console.error('Failed to send feedback email:', error);
        }
    }
};
