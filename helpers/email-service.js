import { config } from '../configs/config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// =========================================
// LOAD CSS
// =========================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const emailStyles = fs.readFileSync(
  path.join(__dirname, '../styles/emailStyles.css'),
  'utf8'
);

// =========================================
// EMAIL SENDER (Brevo HTTP API)
// =========================================
// Railway bloquea los puertos SMTP salientes, por eso no usamos nodemailer.
// Brevo envía por HTTPS (443), que nunca está bloqueado.
const sendEmail = async ({ to, subject, html }) => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('BREVO_API_KEY no configurada');
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: config.smtp.fromName,
        email: config.smtp.fromEmail,
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Error de Brevo ${res.status}: ${detail}`);
  }
};

// =========================================
// EMAIL TEMPLATE
// =========================================
const createEmailTemplate = ({
  title,
  subtitle,
  content,
  buttonText,
  buttonUrl,
}) => {
  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>

    <style>
      ${emailStyles}
    </style>

    <title>${title}</title>
  </head>

  <body>

    <div class="email-wrapper">

      <div class="email-container">

        <!-- HEADER -->
        <div class="email-header">

          <div class="logo">
            KINAL <span>BANC</span>
          </div>

          <div class="logo-line"></div>

        </div>

        <!-- HERO -->
        <div class="email-hero">

          <h1 class="email-title">
            ${title}
          </h1>

          <p class="email-subtitle">
            ${subtitle}
          </p>

        </div>

        <!-- CONTENT -->
        <div class="email-content">

          <div class="content-card">

            <div class="content-text">
              ${content}
            </div>

            ${
              buttonText && buttonUrl
                ? `
                <a
                  href="${buttonUrl}"
                  class="email-button"
                >
                  ${buttonText}
                </a>
              `
                : ''
            }

          </div>

        </div>

        <!-- FOOTER -->
        <div class="email-footer">

          <div class="footer-divider">

            <p class="footer-text">
              Este es un correo automático de Kinal Banc.
              <br/>
              Nunca compartas tus credenciales ni códigos
              de verificación.
            </p>

          </div>

        </div>

      </div>

    </div>

  </body>
  </html>
  `;
};

// =========================================
// VERIFICATION EMAIL
// =========================================
export const sendVerificationEmail = async (email, name, verificationToken) => {

  try {
    const frontendUrl = config.app.frontendUrl || 'http://localhost:3000';

    const verificationUrl = `${frontendUrl}/auth/verify-email?token=${encodeURIComponent(
      verificationToken
    )}`;

    const html = createEmailTemplate({
      title: 'Verifica tu correo',
      subtitle: 'Protegemos tu cuenta con verificación segura.',

      content: `
        <p>
          Hola <strong>${name}</strong>,
        </p>

        <p>
          Gracias por registrarte en Kinal Banc.
          Para activar tu cuenta necesitamos
          verificar tu correo electrónico.
        </p>

        <p>
          Presiona el botón de abajo para continuar.
        </p>

        <div class="url-box">
          ${verificationUrl}
        </div>

        <p>
          Este enlace expirará en 24 horas.
        </p>
      `,

      buttonText: 'VERIFICAR CUENTA',
      buttonUrl: verificationUrl,
    });

    await sendEmail({
      to: email,
      subject: 'Verifica tu cuenta | Kinal Banc',
      html,
    });

    console.log('Verification email sent');
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// =========================================
// PASSWORD RESET EMAIL
// =========================================
export const sendPasswordResetEmail = async (email, name, resetToken) => {

  try {
    const frontendUrl = config.app.frontendUrl || 'http://localhost:3000';

    const encodedToken = encodeURIComponent(resetToken);

    // Enlace web (escritorio / navegador; tambien sirve desplegado).
    const webUrl = `${frontendUrl}/auth/reset-password?token=${encodedToken}`;

    const html = createEmailTemplate({
      title: 'Restablece tu contraseña',

      subtitle: 'Recibimos una solicitud para cambiar tus credenciales.',

      content: `
        <p>
          Hola <strong>${name}</strong>,
        </p>

        <p>
          Recibimos una solicitud para
          restablecer tu contraseña.
        </p>

        <p>
          Si estás en tu computadora, usa el botón de abajo.
        </p>

        <div class="code-box">
          <p class="code-box-label">¿Prefieres continuar en la app? Copia y pega este código</p>
          <span class="code-box-value">${resetToken}</span>
          <p class="code-box-hint">
            Mantén presionado sobre el código y arrastra para seleccionarlo completo
            (no toques dos veces: el código tiene guiones que cortan la selección a la mitad).
          </p>
        </div>

        <div class="url-box">
          ${webUrl}
        </div>

        <p>
          Este código expirará en 1 hora.
        </p>
      `,

      buttonText: 'CAMBIAR CONTRASEÑA',
      buttonUrl: webUrl,
    });

    await sendEmail({
      to: email,
      subject: 'Restablecimiento de contraseña',
      html,
    });

    console.log('Password reset email sent');
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// =========================================
// WELCOME EMAIL
// =========================================
export const sendWelcomeEmail = async (email, name) => {

  try {
    const html = createEmailTemplate({
      title: 'Bienvenido a Kinal Banc',

      subtitle: 'Tu cuenta ha sido verificada correctamente.',

      content: `
        <p>
          Hola <strong>${name}</strong>,
        </p>

        <p>
          Tu cuenta ya está activa.
        </p>

        <ul class="feature-list">
          <li>Transferencias seguras</li>
          <li>Control de movimientos</li>
          <li>Gestión de cuentas</li>
          <li>Seguridad avanzada</li>
        </ul>

        <p>
          Gracias por confiar en nosotros.
        </p>
      `,
    });

    await sendEmail({
      to: email,
      subject: 'Bienvenido a Kinal Banc',
      html,
    });

    console.log('Welcome email sent');
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// =========================================
// RESTAURANT ASSIGNMENT EMAIL
// =========================================
export const sendRestaurantAssignmentEmail = async (email, name, restaurantName) => {

  try {
    const html = createEmailTemplate({
      title: 'Asignación a restaurante',
      subtitle: 'Has sido asignado como administrador de un restaurante.',

      content: `
        <p>
          Hola <strong>${name}</strong>,
        </p>

        <p>
          Has sido asignado como administrador del restaurante
          <strong>${restaurantName}</strong>.
        </p>

        <p>
          Ahora puedes gestionar los menús, pedidos y
          configuraciones del restaurante desde tu panel.
        </p>
      `,
    });

    await sendEmail({
      to: email,
      subject: `Asignado a ${restaurantName} | Kinal Banc`,
      html,
    });

    console.log('Restaurant assignment email sent');
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// =========================================
// PASSWORD CHANGED EMAIL
// =========================================
export const sendPasswordChangedEmail = async (email, name) => {

  try {
    const html = createEmailTemplate({
      title: 'Contraseña actualizada',

      subtitle: 'La seguridad de tu cuenta fue actualizada.',

      content: `
        <p>
          Hola <strong>${name}</strong>,
        </p>

        <p>
          Tu contraseña fue modificada exitosamente.
        </p>

        <div class="alert-box">

          <strong>Importante</strong>

          <p>
            Si no reconoces esta actividad,
            cambia tus credenciales inmediatamente.
          </p>

        </div>
      `,
    });

    await sendEmail({
      to: email,
      subject: 'Contraseña actualizada',
      html,
    });

    console.log('Password changed email sent');
  } catch (error) {
    console.error(error);
    throw error;
  }
};