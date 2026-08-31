import type { MailMessage } from './mailer.ts';

// Emails are plain, inline-styled HTML: mail clients strip <style> blocks and
// external CSS, and the app's own theming has no meaning in an inbox.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(title: string, intro: string, buttonLabel: string, url: string, footer: string): string {
  const safeUrl = escapeHtml(url);
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2933">
    <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
      <tr><td>
        <h1 style="margin:0 0 16px;font-size:22px">${escapeHtml(title)}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6">${escapeHtml(intro)}</p>
        <p style="margin:0 0 24px">
          <a href="${safeUrl}" style="display:inline-block;background:#e8590c;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">${escapeHtml(buttonLabel)}</a>
        </p>
        <p style="margin:0 0 8px;font-size:13px;color:#616e7c">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
        <p style="margin:0 0 24px;font-size:13px;word-break:break-all"><a href="${safeUrl}" style="color:#e8590c">${safeUrl}</a></p>
        <p style="margin:0;font-size:13px;color:#616e7c">${escapeHtml(footer)}</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function verificationEmail(to: string, url: string, name?: string): MailMessage {
  const greeting = name ? `Bonjour ${name},` : 'Bonjour,';
  const intro = `${greeting} confirmez votre adresse email pour activer votre compte.`;
  return {
    to,
    subject: 'Confirmez votre adresse email',
    text: `${intro}\n\n${url}\n\nCe lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
    html: layout(
      'Confirmez votre adresse email',
      intro,
      'Confirmer mon email',
      url,
      "Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email."
    )
  };
}

export function resetPasswordEmail(to: string, url: string, name?: string): MailMessage {
  const greeting = name ? `Bonjour ${name},` : 'Bonjour,';
  const intro = `${greeting} vous avez demandé à réinitialiser votre mot de passe.`;
  return {
    to,
    subject: 'Réinitialisez votre mot de passe',
    text: `${intro}\n\n${url}\n\nCe lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — votre mot de passe reste inchangé.`,
    html: layout(
      'Réinitialisez votre mot de passe',
      intro,
      'Choisir un nouveau mot de passe',
      url,
      "Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — votre mot de passe reste inchangé."
    )
  };
}
