import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || 'notificaciones@rzcore.dev';
const FROM_NAME = process.env.FROM_NAME || 'AppRemises';

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const { error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [to],
    subject: 'Recuperación de contraseña — AppRemises',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 40px 20px;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
          <img src="https://rzcore.dev/Isologo.png" alt="RZCore Logo" width="80" style="display: block; margin: 0 auto 12px auto; filter: drop-shadow(0px 4px 6px rgba(0,0,0,0.3));" />
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">AppRemises</h1>
        </div>

        <!-- Body -->
        <div style="background: #ffffff; border-radius: 0 0 16px 16px; padding: 40px 32px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
          <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 20px; font-weight: 600;">Recuperá tu contraseña</h2>
          <p style="margin: 0 0 24px; color: #475569; font-size: 15px; line-height: 1.6;">
            Recibimos una solicitud para restablecer la contraseña de tu cuenta. 
            Hacé clic en el botón de abajo para crear una nueva contraseña.
          </p>

          <!-- CTA Button -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 600; letter-spacing: 0.3px;">
              Restablecer contraseña
            </a>
          </div>

          <!-- Warning -->
          <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; color: #92400e; font-size: 13px;">
              ⏱️ <strong>Este link expira en 1 hora.</strong> Si no solicitaste este cambio, podés ignorar este email de forma segura.
            </p>
          </div>

          <!-- Fallback URL -->
          <p style="margin: 24px 0 0; color: #94a3b8; font-size: 12px; line-height: 1.6;">
            Si el botón no funciona, copiá este link en tu navegador:<br/>
            <a href="${resetUrl}" style="color: #3b82f6; word-break: break-all;">${resetUrl}</a>
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 24px;">
          <p style="margin: 0; color: #94a3b8; font-size: 12px;">
            Este email fue enviado por <strong>rzcore.dev</strong> · Sistema de gestión AppRemises
          </p>
        </div>

      </div>
    `,
  });

  if (error) {
    console.error('Error enviando email de recuperación:', error);
    throw new Error(`Error al enviar email: ${error.message}`);
  }
}
