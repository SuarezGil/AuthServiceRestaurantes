import nodemailer from 'nodemailer';
import { config } from '../configs/config.js';

// Marca visual de los correos: misma paleta terracota/marrón usada en la app
// móvil y el frontend web, para que el remitente se vea coherente con el producto.
const BRAND = {
  name: 'Gestor de Restaurantes',
  primary: '#C1440E',
  primaryDark: '#7C2D12',
  background: '#FBF7F4',
  surface: '#FFFFFF',
  text: '#1C1917',
  textMuted: '#78716C',
  border: '#F0E6DE',
};

// Configurar el transportador de email (aligned with .NET SmtpSettings)
const createTransporter = () => {
  if (!config.smtp.username || !config.smtp.password) {
    console.warn(
      'SMTP credentials not configured. Email functionality will not work.'
    );
    return null;
  }

  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const isSecure = port === 465; // true para 465, false para 587

  return nodemailer.createTransport({
    host: config.smtp.host,
    port: port,
    secure: isSecure,
    auth: {
      user: config.smtp.username,
      pass: config.smtp.password,
    },
    // Evitar que las peticiones HTTP queden colgadas si SMTP no responde
    connectionTimeout: 10_000, // 10s
    greetingTimeout: 10_000, // 10s
    socketTimeout: 10_000, // 10s
    tls: {
      rejectUnauthorized: false,
    },
  });
};

const transporter = createTransporter();

// Envuelve el contenido de cada correo en una plantilla HTML consistente (tabla,
// compatible con la mayoría de clientes de correo). El "preheader" es el texto
// oculto que algunos clientes muestran como preview junto al asunto.
const wrapEmailTemplate = ({ preheader = '', title, bodyHtml }) => `
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body style="margin:0; padding:0; background-color:${BRAND.background}; font-family: Arial, Helvetica, sans-serif;">
    <span style="display:none; font-size:1px; color:${BRAND.background}; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
      ${preheader}
    </span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.background}; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:520px; background-color:${BRAND.surface}; border-radius:16px; overflow:hidden; border:1px solid ${BRAND.border};">
            <tr>
              <td style="background-color:${BRAND.primaryDark}; padding:28px 32px; text-align:center;">
                <span style="font-size:20px; font-weight:bold; color:#ffffff; letter-spacing:0.4px;">
                  🍽️ ${BRAND.name}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px; background-color:${BRAND.background}; border-top:1px solid ${BRAND.border};">
                <p style="margin:0; font-size:12px; color:${BRAND.textMuted}; text-align:center; line-height:18px;">
                  Este es un mensaje automático de ${BRAND.name}. Por favor no respondas a este correo.<br />
                  Si no reconoces esta actividad, puedes ignorar este mensaje con seguridad.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

const button = (url, label) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 8px 0 20px;">
    <tr>
      <td style="border-radius:10px; background-color:${BRAND.primary};">
        <a href="${url}" target="_blank" style="display:inline-block; padding:14px 28px; font-size:15px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:10px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>
`;

const paragraph = (text) =>
  `<p style="margin:0 0 16px; font-size:15px; line-height:22px; color:${BRAND.text};">${text}</p>`;

const smallMuted = (text) =>
  `<p style="margin:16px 0 0; font-size:13px; line-height:20px; color:${BRAND.textMuted};">${text}</p>`;

export const sendVerificationEmail = async (email, name, verificationToken) => {
  if (!transporter) {
    throw new Error('El transportador SMTP no está configurado');
  }

  try {
    const frontendUrl = config.app.frontendUrl || 'http://localhost:3000';
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

    const bodyHtml = `
      <h1 style="margin:0 0 16px; font-size:20px; color:${BRAND.text};">¡Hola, ${name}!</h1>
      ${paragraph(
        `Gracias por registrarte en <strong>${BRAND.name}</strong>. Para activar tu cuenta y empezar a reservar mesas, hacer pedidos y descubrir restaurantes, confirma tu correo electrónico.`
      )}
      ${button(verificationUrl, 'Verificar mi correo')}
      ${smallMuted(
        `Si el botón no funciona, copia y pega este enlace en tu navegador:<br /><a href="${verificationUrl}" style="color:${BRAND.primary}; word-break:break-all;">${verificationUrl}</a>`
      )}
      ${smallMuted('Este enlace expira en 24 horas. Si tú no creaste esta cuenta, puedes ignorar este correo.')}
    `;

    const text = [
      `¡Hola, ${name}!`,
      '',
      `Gracias por registrarte en ${BRAND.name}. Confirma tu correo electrónico entrando al siguiente enlace:`,
      verificationUrl,
      '',
      'Este enlace expira en 24 horas. Si tú no creaste esta cuenta, puedes ignorar este mensaje.',
    ].join('\n');

    const mailOptions = {
      from: `${config.smtp.fromName} <${config.smtp.fromEmail}>`,
      to: email,
      subject: `Confirma tu correo — ${BRAND.name}`,
      html: wrapEmailTemplate({
        preheader: 'Confirma tu correo para activar tu cuenta.',
        title: 'Verifica tu correo',
        bodyHtml,
      }),
      text,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error al enviar el correo de verificación:', error);
    throw error;
  }
};

export const sendPasswordResetEmail = async (email, name, resetToken) => {
  if (!transporter) {
    throw new Error('El transportador SMTP no está configurado');
  }

  try {
    const frontendUrl = config.app.frontendUrl || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    const bodyHtml = `
      <h1 style="margin:0 0 16px; font-size:20px; color:${BRAND.text};">Solicitud de restablecimiento</h1>
      ${paragraph(
        `Hola ${name}, recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>${BRAND.name}</strong>. Haz clic en el siguiente botón para crear una nueva contraseña.`
      )}
      ${button(resetUrl, 'Restablecer contraseña')}
      ${smallMuted(
        `Si el botón no funciona, copia y pega este enlace en tu navegador:<br /><a href="${resetUrl}" style="color:${BRAND.primary}; word-break:break-all;">${resetUrl}</a>`
      )}
      ${smallMuted('Este enlace expira en 1 hora. Si tú no solicitaste esto, ignora este correo — tu contraseña seguirá siendo la misma.')}
    `;

    const text = [
      `Hola ${name},`,
      '',
      `Recibimos una solicitud para restablecer la contraseña de tu cuenta en ${BRAND.name}. Entra al siguiente enlace para crear una nueva:`,
      resetUrl,
      '',
      'Este enlace expira en 1 hora. Si tú no solicitaste esto, ignora este mensaje.',
    ].join('\n');

    const mailOptions = {
      from: `${config.smtp.fromName} <${config.smtp.fromEmail}>`,
      to: email,
      subject: `Restablece tu contraseña — ${BRAND.name}`,
      html: wrapEmailTemplate({
        preheader: 'Restablece tu contraseña.',
        title: 'Restablece tu contraseña',
        bodyHtml,
      }),
      text,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error al enviar el correo de restablecimiento de contraseña:', error);
    throw error;
  }
};

export const sendWelcomeEmail = async (email, name) => {
  if (!transporter) {
    throw new Error('El transportador SMTP no está configurado');
  }

  try {
    const bodyHtml = `
      <h1 style="margin:0 0 16px; font-size:20px; color:${BRAND.text};">¡Bienvenido/a, ${name}!</h1>
      ${paragraph(`Tu cuenta en <strong>${BRAND.name}</strong> ya está verificada y activa.`)}
      ${paragraph('Ya puedes reservar mesas, explorar restaurantes, hacer pedidos y aprovechar nuestras promociones desde la app.')}
      ${smallMuted('Si tienes alguna pregunta, no dudes en contactar a nuestro equipo de soporte.')}
    `;

    const text = [
      `¡Bienvenido/a, ${name}!`,
      '',
      `Tu cuenta en ${BRAND.name} ya está verificada y activa.`,
      'Ya puedes reservar mesas, explorar restaurantes, hacer pedidos y aprovechar nuestras promociones desde la app.',
    ].join('\n');

    const mailOptions = {
      from: `${config.smtp.fromName} <${config.smtp.fromEmail}>`,
      to: email,
      subject: `¡Bienvenido/a a ${BRAND.name}!`,
      html: wrapEmailTemplate({
        preheader: 'Tu cuenta ya está activa.',
        title: 'Bienvenido',
        bodyHtml,
      }),
      text,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error al enviar el correo de bienvenida:', error);
    throw error;
  }
};

export const sendPasswordChangedEmail = async (email, name) => {
  if (!transporter) {
    throw new Error('El transportador SMTP no está configurado');
  }

  try {
    const bodyHtml = `
      <h1 style="margin:0 0 16px; font-size:20px; color:${BRAND.text};">Contraseña actualizada</h1>
      ${paragraph(`Hola ${name}, tu contraseña de <strong>${BRAND.name}</strong> se actualizó correctamente.`)}
      ${smallMuted('Si no realizaste este cambio, contacta a nuestro equipo de soporte de inmediato.')}
    `;

    const text = [
      `Hola ${name},`,
      '',
      `Tu contraseña de ${BRAND.name} se actualizó correctamente.`,
      'Si no realizaste este cambio, contacta a nuestro equipo de soporte de inmediato.',
    ].join('\n');

    const mailOptions = {
      from: `${config.smtp.fromName} <${config.smtp.fromEmail}>`,
      to: email,
      subject: `Contraseña actualizada — ${BRAND.name}`,
      html: wrapEmailTemplate({
        preheader: 'Tu contraseña fue actualizada.',
        title: 'Contraseña actualizada',
        bodyHtml,
      }),
      text,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error al enviar el correo de cambio de contraseña:', error);
    throw error;
  }
};

export const sendRestaurantAssignmentEmail = async (email, name, restaurantName) => {
  if (!transporter) {
    throw new Error('El transportador SMTP no está configurado');
  }

  try {
    const bodyHtml = `
      <h1 style="margin:0 0 16px; font-size:20px; color:${BRAND.text};">Nueva asignación</h1>
      ${paragraph(
        `Hola ${name}, te comunicamos que fuiste asignado/a como administrador/a del restaurante <strong>${restaurantName}</strong> en ${BRAND.name}.`
      )}
      ${paragraph('Ya tienes acceso a las herramientas de gestión: carta, mesas, reservaciones, pedidos y promociones.')}
      ${smallMuted('Si tienes alguna pregunta, no dudes en contactar a nuestro equipo de soporte.')}
    `;

    const text = [
      `Hola ${name},`,
      '',
      `Te comunicamos que fuiste asignado/a como administrador/a del restaurante ${restaurantName} en ${BRAND.name}.`,
      'Ya tienes acceso a las herramientas de gestión: carta, mesas, reservaciones, pedidos y promociones.',
    ].join('\n');

    const mailOptions = {
      from: `${config.smtp.fromName} <${config.smtp.fromEmail}>`,
      to: email,
      subject: `Fuiste asignado a ${restaurantName} — ${BRAND.name}`,
      html: wrapEmailTemplate({
        preheader: `Ahora administras ${restaurantName}.`,
        title: 'Asignación de restaurante',
        bodyHtml,
      }),
      text,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error al enviar el correo de asignación de restaurante:', error);
    throw error;
  }
};
