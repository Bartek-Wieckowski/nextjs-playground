import nodemailer from "nodemailer";

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// ============================================
// Email do właściciela firmy – nowy wniosek
// ============================================

export async function sendOrganizationRequestEmail({
  fullName,
  email,
  organizationName,
  description,
  approveUrl,
}: {
  fullName: string;
  email: string;
  organizationName: string;
  description: string;
  approveUrl: string;
}) {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"System" <${process.env.SMTP_FROM}>`,
    to: process.env.OWNER_EMAIL,
    subject: `Nowy wniosek o organizację: ${organizationName}`,
    html: `
      <!DOCTYPE html>
      <html lang="pl">
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

          <div style="background: #1d4ed8; padding: 32px 40px;">
            <h1 style="color: #fff; margin: 0; font-size: 22px;">Nowy wniosek o założenie organizacji</h1>
          </div>

          <div style="padding: 40px;">
            <p style="color: #374151; font-size: 15px; margin-top: 0;">
              Ktoś wypełnił formularz i prosi o założenie organizacji w systemie. Szczegóły poniżej:
            </p>

            <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
              <tr>
                <td style="padding: 12px 16px; background: #f9fafb; border: 1px solid #e5e7eb; font-weight: bold; color: #374151; width: 40%;">Imię i nazwisko</td>
                <td style="padding: 12px 16px; border: 1px solid #e5e7eb; color: #111827;">${fullName}</td>
              </tr>
              <tr>
                <td style="padding: 12px 16px; background: #f9fafb; border: 1px solid #e5e7eb; font-weight: bold; color: #374151;">Email</td>
                <td style="padding: 12px 16px; border: 1px solid #e5e7eb; color: #111827;">${email}</td>
              </tr>
              <tr>
                <td style="padding: 12px 16px; background: #f9fafb; border: 1px solid #e5e7eb; font-weight: bold; color: #374151;">Nazwa organizacji</td>
                <td style="padding: 12px 16px; border: 1px solid #e5e7eb; color: #111827;">${organizationName}</td>
              </tr>
              <tr>
                <td style="padding: 12px 16px; background: #f9fafb; border: 1px solid #e5e7eb; font-weight: bold; color: #374151;">Opis</td>
                <td style="padding: 12px 16px; border: 1px solid #e5e7eb; color: #111827;">${description || "—"}</td>
              </tr>
            </table>

            <div style="text-align: center; margin: 36px 0;">
              <a
                href="${approveUrl}"
                target="_blank"
                style="display: inline-block; background: #16a34a; color: #fff; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-size: 16px; font-weight: bold; letter-spacing: 0.3px;"
              >
                ✅ Stwórz organizację
              </a>
            </div>

            <p style="color: #6b7280; font-size: 13px; text-align: center;">
              Kliknięcie przycisku automatycznie utworzy organizację, konto użytkownika<br>
              i wyśle mu link do pierwszego logowania.
            </p>
          </div>

          <div style="background: #f9fafb; padding: 20px 40px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
              Jeśli nie spodziewałeś się tego emaila, możesz go zignorować.
            </p>
          </div>

        </div>
      </body>
      </html>
    `,
  });
}

// ============================================
// Email z zaproszeniem na super admina
// ============================================

export async function sendSuperAdminInviteEmail({
  to,
  url,
}: {
  to: string;
  url: string;
}) {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"System" <${process.env.SMTP_FROM}>`,
    to,
    subject: "Zaproszenie do roli Super Admin",
    html: `
      <!DOCTYPE html>
      <html lang="pl">
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <div style="background: #7c3aed; padding: 32px 40px;">
            <h1 style="color: #fff; margin: 0; font-size: 22px;">Zaproszenie do panelu Super Admin</h1>
          </div>
          <div style="padding: 40px;">
            <p style="color: #374151; font-size: 15px; margin-top: 0;">
              Zostałeś zaproszony do roli Super Admina w systemie.
            </p>
            <div style="text-align: center; margin: 36px 0;">
              <a href="${url}" style="display: inline-block; background: #7c3aed; color: #fff; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-size: 16px; font-weight: bold;">
                Akceptuj zaproszenie
              </a>
            </div>
            <p style="color: #6b7280; font-size: 13px; text-align: center;">
              Link wygaśnie po 7 dniach. Jeśli nie spodziewałeś się tego emaila, zignoruj go.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  });
}

// ============================================
// Email z zaproszeniem do organizacji – magic link
// ============================================

export async function sendMemberInviteEmail({
  fullName,
  email,
  organizationName,
  magicLink,
}: {
  fullName: string;
  email: string;
  organizationName: string;
  magicLink: string;
}) {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"System" <${process.env.SMTP_FROM}>`,
    to: email,
    subject: `Zaproszenie do organizacji ${organizationName}`,
    html: `
      <!DOCTYPE html>
      <html lang="pl">
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

          <div style="background: #0f766e; padding: 32px 40px;">
            <h1 style="color: #fff; margin: 0; font-size: 22px;">Zaproszenie do ${organizationName}</h1>
          </div>

          <div style="padding: 40px;">
            <p style="color: #374151; font-size: 15px; margin-top: 0;">
              Cześć <strong>${fullName}</strong>,
            </p>
            <p style="color: #374151; font-size: 15px;">
              Zostałeś zaproszony do organizacji <strong>${organizationName}</strong>.
              Kliknij poniższy przycisk, aby zalogować się do panelu.
            </p>
            <p style="color: #6b7280; font-size: 13px;">
              Link jest jednorazowy i wygaśnie po 24 godzinach.
            </p>

            <div style="text-align: center; margin: 36px 0;">
              <a
                href="${magicLink}"
                style="display: inline-block; background: #0f766e; color: #fff; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-size: 16px; font-weight: bold; letter-spacing: 0.3px;"
              >
                Zaloguj się do dashboardu
              </a>
            </div>

            <p style="color: #6b7280; font-size: 13px; text-align: center;">
              Jeśli przycisk nie działa, skopiuj i wklej ten link do przeglądarki:<br>
              <a href="${magicLink}" style="color: #0f766e; word-break: break-all;">${magicLink}</a>
            </p>
          </div>

          <div style="background: #f9fafb; padding: 20px 40px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
              Jeśli nie spodziewałeś się tego emaila, zignoruj go.
            </p>
          </div>

        </div>
      </body>
      </html>
    `,
  });
}

// ============================================
// Email do nowego użytkownika – magic link
// ============================================

export async function sendWelcomeEmail({
  fullName,
  email,
  organizationName,
  magicLink,
}: {
  fullName: string;
  email: string;
  organizationName: string;
  magicLink: string;
}) {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"System" <${process.env.SMTP_FROM}>`,
    to: email,
    subject: `Twoje konto w ${organizationName} jest gotowe!`,
    html: `
      <!DOCTYPE html>
      <html lang="pl">
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

          <div style="background: #1d4ed8; padding: 32px 40px;">
            <h1 style="color: #fff; margin: 0; font-size: 22px;">Witaj w ${organizationName}!</h1>
          </div>

          <div style="padding: 40px;">
            <p style="color: #374151; font-size: 15px; margin-top: 0;">
              Cześć <strong>${fullName}</strong>,
            </p>
            <p style="color: #374151; font-size: 15px;">
              Twoje konto oraz organizacja <strong>${organizationName}</strong> zostały właśnie utworzone.
              Możesz teraz zalogować się do panelu klikając poniższy przycisk.
            </p>
            <p style="color: #6b7280; font-size: 13px;">
              Link jest jednorazowy i wygaśnie po 24 godzinach.
            </p>

            <div style="text-align: center; margin: 36px 0;">
              <a
                href="${magicLink}"
                style="display: inline-block; background: #1d4ed8; color: #fff; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-size: 16px; font-weight: bold; letter-spacing: 0.3px;"
              >
                🚀 Zaloguj się do dashboardu
              </a>
            </div>

            <p style="color: #6b7280; font-size: 13px; text-align: center;">
              Jeśli przycisk nie działa, skopiuj i wklej ten link do przeglądarki:<br>
              <a href="${magicLink}" style="color: #1d4ed8; word-break: break-all;">${magicLink}</a>
            </p>
          </div>

          <div style="background: #f9fafb; padding: 20px 40px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
              Jeśli nie rejestrowałeś się w naszym systemie, zignoruj ten email.
            </p>
          </div>

        </div>
      </body>
      </html>
    `,
  });
}
