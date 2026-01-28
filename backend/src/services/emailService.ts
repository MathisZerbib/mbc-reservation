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

        const date = dayjs(booking.startTime).format('D MMMM YYYY');
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
                                from: `Micro-brasserie de Chamonix <${FROM_EMAIL}>`,
                                to: booking.guestEmail,
                                subject: `Votre réservation est confirmée ! - Micro-brasserie de Chamonix`,
                                html: `
                                <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; color: #222; padding: 0; margin: 0;">
                                    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 40px auto; background: #fff; border-radius: 16px; box-shadow: 0 2px 12px #0001; overflow: hidden;">
                                        <tr>
                                            <td style="background: #23272f; padding: 32px 24px 16px 24px; text-align: center;">
                                                <img src="https://i.imgur.com/0Q9QZpT.png" alt="MBC Logo" style="width: 80px; border-radius: 12px; margin-bottom: 12px;" />
                                                <h1 style="color: #fff; font-size: 2rem; margin: 0; letter-spacing: 1px;">Micro-brasserie de Chamonix</h1>
                                                <p style="color: #b3b3b3; margin: 8px 0 0 0; font-size: 1.1rem;">Ambiance décontractée, burgers, snacks & musique live</p>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 32px 24px 16px 24px;">
                                                <h2 style="color: #4f46e5; margin-top: 0;">Bonjour ${booking.guestName},</h2>
                                                <p>Votre réservation est <b>confirmée</b> ! Nous sommes ravis de vous accueillir à la Micro-brasserie de Chamonix.</p>
                                                <div style="background: #f3f4f6; padding: 20px; border-radius: 10px; margin: 24px 0; font-size: 1.1rem;">
                                                    <p style="margin: 0 0 8px 0;"><b>Date :</b> ${date}</p>
                                                    <p style="margin: 0 0 8px 0;"><b>Heure :</b> ${time}</p>
                                                    <p style="margin: 0 0 8px 0;"><b>Nombre de personnes :</b> ${booking.size}</p>
                                                </div>
                                                <p style="margin: 24px 0 0 0;">Profitez de notre terrasse, concerts live et restauration au bar dans un cadre industriel unique.</p>
                                                <p style="margin: 0;">Adresse : <a href="https://maps.app.goo.gl/4Qw1Qw1Qw1Qw1Qw1A" style="color: #4f46e5; text-decoration: underline;">350 Rte du Bouchet, 74400 Chamonix-Mont-Blanc</a></p>
                                                <p style="margin: 0;">Téléphone : <a href="tel:0450536159" style="color: #4f46e5; text-decoration: underline;">04 50 53 61 59</a></p>
                                                <div style="margin: 24px 0 0 0;">
                                                    <table style="font-size: 0.95rem; color: #444;">
                                                        <tr><td><b>Horaires :</b></td><td style="padding-left: 12px;">16:00–02:00 (tous les jours)</td></tr>
                                                    </table>
                                                </div>
                                                <div style="margin: 32px 0 0 0; text-align: center;">
                                                    <a href="https://maps.app.goo.gl/4Qw1Qw1Qw1Qw1Qw1A" style="background: #4f46e5; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 1.1rem;">Voir sur Google Maps</a>
                                                </div>
                                                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
                                                <p style="font-size: 0.95rem; color: #6b7280;">Besoin de modifier ou annuler votre réservation ? Contactez-nous par téléphone ou répondez à cet email.</p>
                                                <p style="font-size: 0.95rem; color: #6b7280;">À très bientôt !<br>L’équipe de la Micro-brasserie de Chamonix</p>
                                            </td>
                                        </tr>
                                    </table>
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
                                from: `Micro-brasserie de Chamonix <${FROM_EMAIL}>`,
                                to: booking.guestEmail,
                                subject: `Votre avis compte pour nous ! - Micro-brasserie de Chamonix`,
                                html: `
                                <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; color: #222; padding: 0; margin: 0;">
                                    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 40px auto; background: #fff; border-radius: 16px; box-shadow: 0 2px 12px #0001; overflow: hidden;">
                                        <tr>
                                            <td style="background: #23272f; padding: 32px 24px 16px 24px; text-align: center;">
                                                <img src="https://i.imgur.com/0Q9QZpT.png" alt="MBC Logo" style="width: 80px; border-radius: 12px; margin-bottom: 12px;" />
                                                <h1 style="color: #fff; font-size: 2rem; margin: 0; letter-spacing: 1px;">Micro-brasserie de Chamonix</h1>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 32px 24px 16px 24px; text-align: center;">
                                                <h2 style="color: #4f46e5; margin-top: 0;">Merci pour votre visite, ${booking.guestName} !</h2>
                                                <p>Nous espérons que vous avez passé un excellent moment à la Micro-brasserie de Chamonix.</p>
                                                <p style="margin: 24px 0 0 0;">Votre avis est précieux pour nous aider à nous améliorer et à offrir la meilleure expérience possible à nos clients.</p>
                                                <div style="margin: 32px 0 32px 0;">
                                                    <a href="${GOOGLE_MAPS_REVIEW_URL}" style="background: #4f46e5; color: #fff; padding: 16px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 1.1rem;">Laisser un avis sur Google</a>
                                                </div>
                                                <p style="color: #6b7280; font-size: 0.98rem;">Quelques mots suffisent, et cela fait toute la différence pour notre équipe !</p>
                                                <p style="font-size: 0.95rem; color: #6b7280;">Merci et à bientôt,<br>L’équipe de la Micro-brasserie de Chamonix</p>
                                            </td>
                                        </tr>
                                    </table>
                                </div>
                                `,
                        });
            console.log(`Feedback email sent to ${booking.guestEmail}`);
        } catch (error) {
            console.error('Failed to send feedback email:', error);
        }
    }
};
