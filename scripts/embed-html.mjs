import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const template = fs.readFileSync(path.join(root, "worker", "index.template.js"), "utf8");
const html = fs.readFileSync(path.join(root, "dist", "index.html"), "utf8");
const sneakPeek = fs.readFileSync(path.join(root, "assets", "pawprint-sneak-peek.gif")).toString("base64");
const sneakPeekSvg = fs.readFileSync(path.join(root, "assets", "pawprint-sneakpeek.svg"), "utf8");
const icon = fs.readFileSync(path.join(root, "assets", "pawprint-icon.svg"), "utf8");
const catPaw = fs.readFileSync(path.join(root, "assets", "cat-paw.svg"), "utf8");
const pawprintCat = fs.readFileSync(path.join(root, "assets", "pawprint-cat.js"), "utf8");
const supabaseAuth = fs.readFileSync(path.join(root, "assets", "supabase-auth.js"), "utf8");
const pawLoader = fs.readFileSync(path.join(root, "assets", "paw-loader.js"), "utf8");
const pawloaderActual = fs.readFileSync(path.join(root, "assets", "pawloader.js"), "utf8");
const pawloaderCss = fs.readFileSync(path.join(root, "assets", "pawloader.css"), "utf8");
const pawloaderBridge = fs.readFileSync(path.join(root, "assets", "pawloader-bridge.js"), "utf8");
const pawtrail = fs.readFileSync(path.join(root, "assets", "pawtrail.js"), "utf8");
const offlineQueue = fs.readFileSync(path.join(root, "assets", "offline-queue.js"), "utf8");
const adminConsole = fs.readFileSync(path.join(root, "assets", "admin-console.js"), "utf8");
const mobileUi = fs.readFileSync(path.join(root, "assets", "mobile-ui.js"), "utf8");
const mobileCss = fs.readFileSync(path.join(root, "assets", "mobile-ui.css"), "utf8");
const mobileFont = fs.readFileSync(path.join(root, "assets", "fredoka-latin.woff2")).toString("base64");
const mobileFontLicense = fs.readFileSync(path.join(root, "assets", "Fredoka-OFL.txt"), "utf8");
const output = template
  .replace("__PAWPRINT_HTML__", JSON.stringify(html))
  .replace("__PAWPRINT_SNEAK_PEEK_GIF__", sneakPeek)
  .replace("__PAWPRINT_SNEAK_PEEK_SVG__", JSON.stringify(sneakPeekSvg))
  .replace("__PAWPRINT_ICON_SVG__", JSON.stringify(icon))
  .replace("__PAWPRINT_CAT_PAW_SVG__", JSON.stringify(catPaw))
  .replace("__PAWPRINT_CAT_JS__", JSON.stringify(pawprintCat))
  .replace("__PAWPRINT_SUPABASE_AUTH_JS__", JSON.stringify(supabaseAuth))
  .replace("__PAWPRINT_PAW_LOADER_JS__", JSON.stringify(pawLoader))
  .replace("__PAWPRINT_PAWLOADER_ACTUAL_JS__", JSON.stringify(pawloaderActual))
  .replace("__PAWPRINT_PAWLOADER_CSS__", JSON.stringify(pawloaderCss))
  .replace("__PAWPRINT_PAWLOADER_BRIDGE__", JSON.stringify(pawloaderBridge))
  .replace("__PAWPRINT_PAWTRAIL_JS__", JSON.stringify(pawtrail))
  .replace("__PAWPRINT_OFFLINE_QUEUE_JS__", JSON.stringify(offlineQueue))
  .replace("__PAWPRINT_ADMIN_CONSOLE_JS__", JSON.stringify(adminConsole))
  .replace("__PAWPRINT_MOBILE_UI_JS__", JSON.stringify(mobileUi))
  .replace("__PAWPRINT_MOBILE_UI_CSS__", JSON.stringify(mobileCss))
  .replace("__PAWPRINT_MOBILE_FONT__", JSON.stringify(mobileFont))
  .replace("__PAWPRINT_MOBILE_FONT_LICENSE__", JSON.stringify(mobileFontLicense));
const serviceWorkerBase = template.match(/^const PWA_SERVICE_WORKER = `([\s\S]*?)`;/m)?.[1];
if (!serviceWorkerBase) throw new Error("Could not extract the Pawprint service worker from its template");
const serviceWorker = `${serviceWorkerBase} self.addEventListener('push',event=>{const data=event.data?event.data.json():{};event.waitUntil(self.registration.showNotification(data.title||'Pawprint',{body:data.body||'Your Pawprint has an update.',icon:'/assets/pawprint-icon.svg',badge:'/assets/pawprint-icon.svg',data:{url:data.url||'/#app'}}));}); self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{const target=event.notification.data&&event.notification.data.url||'/#app';const existing=list.find(client=>client.url.includes(location.origin));return existing?(existing.focus(),existing.navigate(target)):clients.openWindow(target);}));});`;
fs.mkdirSync(path.join(root, "dist", "server"), { recursive: true });
fs.copyFileSync(path.join(root, "assets", "paw-loader.js"), path.join(root, "dist", "assets", "paw-loader.js"));
fs.copyFileSync(path.join(root, "assets", "pawloader.js"), path.join(root, "dist", "assets", "pawloader.js"));
fs.copyFileSync(path.join(root, "assets", "pawloader.css"), path.join(root, "dist", "assets", "pawloader.css"));
fs.copyFileSync(path.join(root, "assets", "pawloader-bridge.js"), path.join(root, "dist", "assets", "pawloader-bridge.js"));
for (const asset of ["mobile-ui.js", "mobile-ui.css", "fredoka-latin.woff2", "Fredoka-OFL.txt"]) fs.copyFileSync(path.join(root, "assets", asset), path.join(root, "dist", "assets", asset));
fs.copyFileSync(path.join(root, "assets", "pawtrail.js"), path.join(root, "dist", "assets", "pawtrail.js"));
fs.copyFileSync(path.join(root, "assets", "offline-queue.js"), path.join(root, "dist", "assets", "offline-queue.js"));
fs.copyFileSync(path.join(root, "assets", "admin-console.js"), path.join(root, "dist", "assets", "admin-console.js"));
fs.writeFileSync(path.join(root, "dist", "server", "index.js"), output);
fs.writeFileSync(path.join(root, "dist", "sw.js"), `${serviceWorker}\n`);
console.log("Generated dist/server/index.js");
