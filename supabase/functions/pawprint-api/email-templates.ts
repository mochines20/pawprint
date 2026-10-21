const BRAND = {
  ink: "#151515",
  paper: "#FAF8F4",
  white: "#FFFFFF",
  amber: "#FFB400",
  amberSoft: "#FFF1C9",
  stone: "#77736C",
  line: "#E3DFD6",
};

// Use a rounded, widely available fallback stack so the email keeps the Pawprint
// personality even when the recipient's mail client blocks web fonts.
const FONT = "'Arial Rounded MT Bold', 'Trebuchet MS', Arial, Helvetica, sans-serif";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value: unknown) {
  const url = String(value ?? "").trim();
  if (!url || !/^https:\/\//i.test(url)) return "";
  return escapeHtml(url);
}

export type PawprintEmailOptions = {
  logoUrl?: string;
  eyebrow?: string;
  title: string;
  intro: string;
  body?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
};

/**
 * Pawprint's transactional email markup.
 * Keep this as the single source of truth for the email's branded look.
 * The markup intentionally uses tables and inline styles for Gmail/Outlook support.
 */
export function pawprintEmailTemplate(options: PawprintEmailOptions) {
  const logoUrl = safeUrl(options.logoUrl);
  const eyebrow = escapeHtml(options.eyebrow || "Pawprint update");
  const title = escapeHtml(options.title);
  const intro = escapeHtml(options.intro);
  const body = options.body ? escapeHtml(options.body) : "";
  const footerNote = escapeHtml(options.footerNote || "Public pins stay approximate and delayed for safety.");
  const ctaUrl = safeUrl(options.ctaUrl);
  const ctaLabel = escapeHtml(options.ctaLabel || "Open Pawprint");
  const cta = ctaUrl
    ? `<tr><td style="padding:0 0 26px;"><a href="${ctaUrl}" style="display:inline-block;background:${BRAND.amber};border:2px solid ${BRAND.ink};border-radius:999px;box-shadow:0 4px 0 ${BRAND.ink};color:${BRAND.ink};font-family:${FONT};font-size:16px;font-weight:800;line-height:20px;padding:14px 24px;text-decoration:none;">${ctaLabel} &nbsp;→</a></td></tr>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${title}</title>
  </head>
  <body style="margin:0;background:${BRAND.paper};color:${BRAND.ink};font-family:${FONT};-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${intro} &nbsp; Gotta spot 'em all.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.paper};">
      <tr>
        <td align="center" style="padding:18px 12px 44px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;">
            <tr>
              <td style="padding:8px 8px 18px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="middle" align="center" style="background:${BRAND.white};border:2px solid ${BRAND.ink};border-radius:14px;box-shadow:0 3px 0 ${BRAND.ink};width:44px;height:44px;">
                      ${logoUrl ? `<img src="${logoUrl}" alt="Pawprint logo" width="44" height="44" style="display:block;width:44px;height:44px;border:0;border-radius:12px;object-fit:cover;">` : `<span style="color:${BRAND.ink};font-size:22px;font-weight:800;line-height:40px;">P</span>`}
                    </td>
                    <td valign="middle" style="padding-left:12px;color:${BRAND.ink};font-size:22px;font-weight:800;letter-spacing:-.5px;">Pawprint</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:${BRAND.ink};border:2px solid ${BRAND.ink};border-radius:26px 26px 0 0;padding:28px 28px 30px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr><td style="color:${BRAND.amber};font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding-bottom:14px;">${eyebrow}</td></tr>
                  <tr><td style="color:${BRAND.white};font-size:34px;font-weight:800;letter-spacing:-1.2px;line-height:1.08;padding-bottom:12px;font-family:${FONT};">${title}</td></tr>
                  <tr><td style="color:#F2EEE7;font-size:18px;font-weight:700;line-height:1.45;">${intro}</td></tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:${BRAND.white};border:2px solid ${BRAND.ink};border-top:0;border-radius:0 0 26px 26px;box-shadow:0 7px 0 ${BRAND.ink};padding:28px 28px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  ${body ? `<tr><td style="color:${BRAND.stone};font-size:16px;line-height:1.6;padding:0 0 24px;">${body}</td></tr>` : ""}
                  <tr>
                    <td style="background:${BRAND.amberSoft};border:1px solid #F0D88A;border-radius:16px;padding:14px 16px;color:${BRAND.ink};font-size:14px;line-height:1.5;">
                      <strong>&#128062; A safer trace starts small.</strong><br>
                      Your updates help us build a kinder, more careful way to spot street cats.
                    </td>
                  </tr>
                  <tr><td style="padding-top:24px;">${cta}</td></tr>
                  <tr><td style="border-top:1px solid ${BRAND.line};padding-top:18px;color:${BRAND.stone};font-size:13px;line-height:1.55;">${footerNote}</td></tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:28px 10px 0;color:${BRAND.stone};font-size:12px;line-height:1.6;">
                <strong style="color:${BRAND.ink};">Pawprint</strong> &middot; Gotta spot 'em all.<br>
                You're receiving this because you joined Pawprint updates.<br>
                <span style="color:#AAA49A;">Spot cats. Leave a safer trace.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
