import { Resend } from 'resend';
import dayjs from 'dayjs';

const resend = new Resend(process.env.RESEND_API_KEY);

const APP_NAME = 'MBC Restaurant';
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';
const GOOGLE_MAPS_REVIEW_URL = 'https://goo.gl/maps/example'; // TODO: Replace with actual link

export const emailService = {
    sendConfirmationEmail: async (booking: any) => {
        // Skip if no email provided
        if (!booking.email) {
            console.log('No email provided for booking, skipping confirmation email');
            return;
        }

        // Language fallback
        type Lang = 'fr' | 'en' | 'it' | 'es' | 'ru';
        const lang: Lang = (booking.language && ['fr','en','it','es','ru'].includes(booking.language)) ? booking.language : 'fr';
        const date = dayjs(booking.startTime).locale(lang).format(lang === 'en' ? 'MMMM D, YYYY' : 'D MMMM YYYY');
        const time = dayjs(booking.startTime).format('HH:mm');

        // Multilingual content
        const content = {
            fr: {
                subject: 'Votre réservation est confirmée ! - Micro-brasserie de Chamonix',
                greeting: `Bonjour ${booking.name},`,
                intro: 'Votre réservation est <b>confirmée</b> ! Nous sommes ravis de vous accueillir à la Micro-brasserie de Chamonix.',
                date: 'Date',
                time: 'Heure',
                guests: 'Nombre de personnes',
                enjoy: 'Profitez de notre terrasse, concerts live et restauration au bar dans un cadre industriel unique.',
                address: 'Adresse',
                phone: 'Téléphone',
                hours: 'Horaires',
                hoursValue: '16:00–02:00 (tous les jours)',
                map: 'Voir sur Google Maps',
                modify: 'Besoin de modifier ou annuler votre réservation ? Contactez-nous par téléphone ou répondez à cet email.',
                bye: 'À très bientôt !<br>L’équipe de la Micro-brasserie de Chamonix',
            },
            en: {
                subject: 'Your reservation is confirmed! - Micro-brasserie de Chamonix',
                greeting: `Hello ${booking.name},`,
                intro: 'Your reservation is <b>confirmed</b>! We are delighted to welcome you to Micro-brasserie de Chamonix.',
                date: 'Date',
                time: 'Time',
                guests: 'Number of guests',
                enjoy: 'Enjoy our terrace, live concerts, and bar food in a unique industrial setting.',
                address: 'Address',
                phone: 'Phone',
                hours: 'Hours',
                hoursValue: '4:00pm–2:00am (every day)',
                map: 'View on Google Maps',
                modify: 'Need to modify or cancel your reservation? Contact us by phone or reply to this email.',
                bye: 'See you soon!<br>The Micro-brasserie de Chamonix Team',
            },
            it: {
                subject: 'La tua prenotazione è confermata! - Micro-brasserie de Chamonix',
                greeting: `Ciao ${booking.name},`,
                intro: 'La tua prenotazione è <b>confermata</b>! Siamo lieti di accoglierti alla Micro-brasserie de Chamonix.',
                date: 'Data',
                time: 'Ora',
                guests: 'Numero di persone',
                enjoy: 'Goditi la nostra terrazza, concerti dal vivo e cucina da bar in un ambiente industriale unico.',
                address: 'Indirizzo',
                phone: 'Telefono',
                hours: 'Orari',
                hoursValue: '16:00–02:00 (tutti i giorni)',
                map: 'Vedi su Google Maps',
                modify: 'Hai bisogno di modificare o annullare la prenotazione? Contattaci telefonicamente o rispondi a questa email.',
                bye: 'A presto!<br>Il team della Micro-brasserie de Chamonix',
            },
            es: {
                subject: '¡Tu reserva está confirmada! - Micro-brasserie de Chamonix',
                greeting: `Hola ${booking.name},`,
                intro: '¡Tu reserva está <b>confirmada</b>! Nos complace darte la bienvenida a Micro-brasserie de Chamonix.',
                date: 'Fecha',
                time: 'Hora',
                guests: 'Número de personas',
                enjoy: 'Disfruta de nuestra terraza, conciertos en vivo y comida de bar en un entorno industrial único.',
                address: 'Dirección',
                phone: 'Teléfono',
                hours: 'Horario',
                hoursValue: '16:00–02:00 (todos los días)',
                map: 'Ver en Google Maps',
                modify: '¿Necesitas modificar o cancelar tu reserva? Contáctanos por teléfono o responde a este correo.',
                bye: '¡Hasta pronto!<br>El equipo de Micro-brasserie de Chamonix',
            },
            ru: {
                subject: 'Ваш столик забронирован! - Micro-brasserie de Chamonix',
                greeting: `Здравствуйте, ${booking.name}!`,
                intro: 'Ваш столик <b>забронирован</b>! Мы рады приветствовать вас в Micro-brasserie de Chamonix.',
                date: 'Дата',
                time: 'Время',
                guests: 'Количество гостей',
                enjoy: 'Наслаждайтесь нашей террасой, живой музыкой и блюдами бара в уникальной индустриальной атмосфере.',
                address: 'Адрес',
                phone: 'Телефон',
                hours: 'Часы',
                hoursValue: '16:00–02:00 (ежедневно)',
                map: 'Посмотреть на Google Maps',
                modify: 'Хотите изменить или отменить бронирование? Свяжитесь с нами по телефону или ответьте на это письмо.',
                bye: 'До скорой встречи!<br>Команда Micro-brasserie de Chamonix',
            },
        };
        const c = content[lang as Lang] || content['fr'];

        if (!process.env.RESEND_API_KEY) {
            console.log('--- MOCK EMAIL SENDING (No Resend API key) ---');
            console.log('To:', booking.email);
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
                                to: booking.email,
                                subject: c.subject,
                                html: `
                                <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; color: #222; padding: 0; margin: 0;">
                                    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 40px auto; background: #fff; border-radius: 16px; box-shadow: 0 2px 12px #0001; overflow: hidden;">
                                        <tr>
                                            <td style="background: #23272f; padding: 32px 24px 16px 24px; text-align: center;">
                                                <img src="https://imgur.com/vozilL5" alt="MBC Logo" style="width: 80px; border-radius: 12px; margin-bottom: 12px;" />
                                                <h1 style="color: #fff; font-size: 2rem; margin: 0; letter-spacing: 1px;">Micro-brasserie de Chamonix</h1>
                                                <p style="color: #b3b3b3; margin: 8px 0 0 0; font-size: 1.1rem;">Ambiance décontractée, burgers, snacks & musique live</p>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 32px 24px 16px 24px;">
                                                <h2 style="color: #4f46e5; margin-top: 0;">${c.greeting}</h2>
                                                <p>${c.intro}</p>
                                                <div style="background: #f3f4f6; padding: 20px; border-radius: 10px; margin: 24px 0; font-size: 1.1rem;">
                                                    <p style="margin: 0 0 8px 0;"><b>${c.date} :</b> ${date}</p>
                                                    <p style="margin: 0 0 8px 0;"><b>${c.time} :</b> ${time}</p>
                                                    <p style="margin: 0 0 8px 0;"><b>${c.guests} :</b> ${booking.size}</p>
                                                </div>
                                                <p style="margin: 24px 0 0 0;">${c.enjoy}</p>
                                                <p style="margin: 0;">${c.address} : <a href="https://maps.app.goo.gl/4Qw1Qw1Qw1Qw1Qw1A" style="color: #4f46e5; text-decoration: underline;">350 Rte du Bouchet, 74400 Chamonix-Mont-Blanc</a></p>
                                                <p style="margin: 0;">${c.phone} : <a href="tel:0450536159" style="color: #4f46e5; text-decoration: underline;">04 50 53 61 59</a></p>
                                                <div style="margin: 24px 0 0 0;">
                                                    <table style="font-size: 0.95rem; color: #444;">
                                                        <tr><td><b>${c.hours} :</b></td><td style="padding-left: 12px;">${c.hoursValue}</td></tr>
                                                    </table>
                                                </div>
                                                <div style="margin: 32px 0 0 0; text-align: center;">
                                                    <a href="https://maps.app.goo.gl/4Qw1Qw1Qw1Qw1Qw1A" style="background: #4f46e5; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 1.1rem;">${c.map}</a>
                                                </div>
                                                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
                                                <p style="font-size: 0.95rem; color: #6b7280;">${c.modify}</p>
                                                <p style="font-size: 0.95rem; color: #6b7280;">${c.bye}</p>
                                            </td>
                                        </tr>
                                    </table>
                                </div>
                                `,
                        });
            console.log(`Confirmation email sent to ${booking.email}`);
        } catch (error) {
            console.error('Failed to send confirmation email:', error);
        }
    },

    sendFeedbackEmail: async (booking: any) => {
        // Skip if no email provided
        if (!booking.email) {
            console.log('No email provided for booking, skipping feedback email');
            return;
        }

        if (!process.env.RESEND_API_KEY) {
            console.log('--- MOCK FEEDBACK EMAIL (No Resend API key) ---');
            console.log('To:', booking.email);
            return;
        }

        // Multilingual content
        type Lang = 'fr' | 'en' | 'it' | 'es' | 'ru';
        const lang: Lang = (booking.language && ['fr','en','it','es','ru'].includes(booking.language)) ? booking.language : 'fr';
        const content = {
            fr: {
                subject: 'Votre avis compte pour nous ! - Micro-brasserie de Chamonix',
                greeting: `Merci pour votre visite, ${booking.name} !`,
                body: 'Nous espérons que vous avez passé un excellent moment à la Micro-brasserie de Chamonix.',
                ask: 'Votre avis est précieux pour nous aider à nous améliorer et à offrir la meilleure expérience possible à nos clients.',
                button: 'Laisser un avis sur Google',
                thanks: 'Quelques mots suffisent, et cela fait toute la différence pour notre équipe !',
                bye: 'Merci et à bientôt,<br>L’équipe de la Micro-brasserie de Chamonix',
            },
            en: {
                subject: 'We value your feedback! - Micro-brasserie de Chamonix',
                greeting: `Thank you for your visit, ${booking.name}!`,
                body: 'We hope you had a wonderful time at Micro-brasserie de Chamonix.',
                ask: 'Your feedback helps us improve and provide the best experience for our guests.',
                button: 'Leave a review on Google',
                thanks: 'A few words make a big difference for our team!',
                bye: 'Thank you and see you soon,<br>The Micro-brasserie de Chamonix Team',
            },
            it: {
                subject: 'La tua opinione è importante! - Micro-brasserie de Chamonix',
                greeting: `Grazie per la tua visita, ${booking.name}!`,
                body: 'Speriamo che tu abbia trascorso un momento piacevole alla Micro-brasserie de Chamonix.',
                ask: 'La tua opinione ci aiuta a migliorare e offrire la migliore esperienza possibile ai nostri clienti.',
                button: 'Lascia una recensione su Google',
                thanks: 'Bastano poche parole per fare la differenza per il nostro team!',
                bye: 'Grazie e a presto,<br>Il team della Micro-brasserie de Chamonix',
            },
            es: {
                subject: '¡Tu opinión es importante! - Micro-brasserie de Chamonix',
                greeting: `¡Gracias por tu visita, ${booking.name}!`,
                body: 'Esperamos que hayas disfrutado en Micro-brasserie de Chamonix.',
                ask: 'Tu opinión nos ayuda a mejorar y ofrecer la mejor experiencia posible a nuestros clientes.',
                button: 'Deja una reseña en Google',
                thanks: '¡Unas palabras marcan la diferencia para nuestro equipo!',
                bye: '¡Gracias y hasta pronto!<br>El equipo de Micro-brasserie de Chamonix',
            },
            ru: {
                subject: 'Ваш отзыв важен для нас! - Micro-brasserie de Chamonix',
                greeting: `Спасибо за визит, ${booking.name}!`,
                body: 'Надеемся, вам понравилось в Micro-brasserie de Chamonix.',
                ask: 'Ваш отзыв помогает нам становиться лучше и предоставлять лучший сервис нашим гостям.',
                button: 'Оставить отзыв на Google',
                thanks: 'Несколько слов имеют большое значение для нашей команды!',
                bye: 'Спасибо и до скорой встречи!<br>Команда Micro-brasserie de Chamonix',
            },
        };
        const c = content[lang as Lang] || content['fr'];
        try {
            await resend.emails.send({
                from: `Micro-brasserie de Chamonix <${FROM_EMAIL}>`,
                to: booking.email,
                subject: c.subject,
                html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; color: #222; padding: 0; margin: 0;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 40px auto; background: #fff; border-radius: 16px; box-shadow: 0 2px 12px #0001; overflow: hidden;">
                    <tr>
                      <td style="background: #23272f; padding: 32px 24px 16px 24px; text-align: center;">
                        <img src="https://imgur.com/vozilL5" alt="MBC Logo" style="width: 80px; border-radius: 12px; margin-bottom: 12px;" />
                        <h1 style="color: #fff; font-size: 2rem; margin: 0; letter-spacing: 1px;">Micro-brasserie de Chamonix</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 32px 24px 16px 24px; text-align: center;">
                        <h2 style="color: #4f46e5; margin-top: 0;">${c.greeting}</h2>
                        <p>${c.body}</p>
                        <p style="margin: 24px 0 0 0;">${c.ask}</p>
                        <div style="margin: 32px 0 32px 0;">
                          <a href="${GOOGLE_MAPS_REVIEW_URL}" style="background: #4f46e5; color: #fff; padding: 16px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 1.1rem;">${c.button}</a>
                        </div>
                        <p style="color: #6b7280; font-size: 0.98rem;">${c.thanks}</p>
                        <p style="font-size: 0.95rem; color: #6b7280;">${c.bye}</p>
                      </td>
                    </tr>
                  </table>
                </div>
                `,
            });
            console.log(`Feedback email sent to ${booking.email}`);
        } catch (error) {
            console.error('Failed to send feedback email:', error);
        }
    }
};
