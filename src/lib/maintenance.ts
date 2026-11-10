/**
 * Maintenance mode.
 *
 * While on, every public URL answers HTTP 503 with a small branded page and
 * `Retry-After: 86400`, straight from the proxy. Nothing reaches Supabase and
 * no page is rendered or cached, so it adds no ISR writes.
 *
 * To turn it off: set MAINTENANCE_MODE to false below and deploy main, or
 * set the Vercel env var MAINTENANCE_MODE=off and redeploy.
 */
export const MAINTENANCE_MODE = true;

export function isMaintenanceOn(): boolean {
  const env = process.env.MAINTENANCE_MODE?.trim().toLowerCase();
  if (env === "off" || env === "false" || env === "0") return false;
  return MAINTENANCE_MODE;
}

/** Static files the maintenance page itself uses. Everything else is held. */
const PASS_THROUGH = new Set(["/favicon.ico", "/icon.png", "/apple-icon.png", "/robots.txt"]);

export function isMaintenancePassThrough(pathname: string): boolean {
  return PASS_THROUGH.has(pathname);
}

export const MAINTENANCE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TradeFlock USA | We'll Be Back Soon</title>
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-icon.png">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{display:flex;flex-direction:column;min-height:100%;background:#fff;color:#171717;
    font-family:"Source Sans 3","Helvetica Neue",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
  .bar{height:6px;background:#c41e3a}
  main{flex:1;display:flex;align-items:center;justify-content:center;padding:48px 24px;text-align:center}
  .wrap{max-width:560px}
  .mark{display:inline-flex;flex-direction:column;align-items:center;margin-bottom:40px}
  .mark .name{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-weight:700;font-size:44px;
    letter-spacing:-0.01em;color:#0a0a0a;line-height:1}
  .mark .usa{margin-top:10px;font-weight:700;font-size:14px;letter-spacing:.32em;color:#c41e3a;padding-left:.32em}
  .rule{width:64px;height:2px;background:#e5e5e5;margin:0 auto 32px}
  h1{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-weight:700;font-size:34px;line-height:1.2;margin-bottom:14px}
  p{font-size:18px;line-height:1.6;color:#525252}
  footer{padding:24px;text-align:center;font-size:13px;color:#737373;border-top:1px solid #e5e5e5}
  @media (max-width:480px){.mark .name{font-size:36px}h1{font-size:28px}p{font-size:16px}}
</style>
</head>
<body>
<div class="bar"></div>
<main>
  <div class="wrap">
    <div class="mark" aria-label="TradeFlock USA"><span class="name">TradeFlock</span><span class="usa">USA</span></div>
    <div class="rule"></div>
    <h1>We'll Be Back Soon</h1>
    <p>TradeFlock USA is temporarily down for maintenance. Thank you for your patience.</p>
  </div>
</main>
<footer>&copy; TradeFlock USA</footer>
</body>
</html>`;

export function maintenanceResponse(method: string): Response {
  return new Response(method === "HEAD" ? null : MAINTENANCE_HTML, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Retry-After": "86400",
      "Cache-Control": "no-store",
    },
  });
}
