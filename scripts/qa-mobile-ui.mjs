import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);
let playwright;
try{playwright=require(process.env.PAWPRINT_PLAYWRIGHT||'playwright');}catch(error){
  if(process.env.PAWPRINT_PLAYWRIGHT)throw error;
  playwright=require(path.join(process.env.USERPROFILE||process.env.HOME,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
}
const {chromium}=playwright;
const origin=process.env.PAWPRINT_TEST_URL||'http://localhost:4173';
const out=new URL('../qa-artifacts/mobile-ui/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
// Authentication is stubbed only inside this isolated test browser; no production bypass.
await context.route('**/assets/supabase-auth*.js*',route=>route.fulfill({contentType:'application/javascript',body:`window.pawprintAuthGate={ready:true,queue:[]};window.pawprintSession={user:{id:'qa-only'}};window.pawprintPublicProfile={nickname:'QA spotter',avatar:'cat-tangerine'};window.dispatchEvent(new CustomEvent('pawprint-authenticated',{detail:{continueToApp:true}}));`}));
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const entries=Array.from({length:8},(_,i)=>({id:'qa-'+i,sightingId:'qa-'+i,catType:['Orange tabby','Calico','Black cat','Tuxedo'][i%4],rarity:['Common','Rare','Super Rare','Uncommon'][i%4],spottedAt:new Date().toISOString(),firstSpotted:i<4,visibility:i%2?'private':'friends',description:'A calm cat sitting safely under a shaded walkway.',locationLabel:'Approximate Alabang area',photoUrl:'/assets/cat-tabby-gravel.webp'}));
const medals=['Paw Seed','First Paw','Alley Scout','Night Watcher','Street Naturalist','Pawprint Legend'].map((title,i)=>({id:'qa-medal-'+i,title,xpRequired:[0,24,100,250,500,1000][i],earned:i<3,tone:['mist','amber','sage','ink','coral','gold'][i]}));
let profile={display_name:'QA spotter',language:'en',time_zone:'Asia/Manila'},saveCount=0,captureCount=0,failJournal=false,failProgress=false;
const dashboard={streak:{current:4,active:true,helper:'Spot 1 cat today to keep it glowing'},streakCalendar:['M','T','W','T','F','S','S'].map((label,i)=>({label,number:i+12,key:'2026-10-'+(i+12),status:i<4?'complete':'empty',isToday:i===3})),today:{count:1,target:1,validated:true},xp:248,journal:{unique:4},sightings:[]};
const sighting={id:'qa-map-cat',catType:'Calico',area:{latitude:14.42,longitude:121.03},capturedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),photoUrl:'/assets/cat-tabby-gravel.webp',description:'QA map fixture',rarity:'Rare'};
await context.route('**/api/**',async route=>{
 const url=new URL(route.request().url()),method=route.request().method();let data={};
 if(url.pathname==='/api/journal'){if(failJournal)return route.fulfill({status:503,contentType:'application/json',body:'{"error":"UNAVAILABLE"}'});data={entries};}
 else if(url.pathname==='/api/dashboard')data=dashboard;
 else if(url.pathname==='/api/progress'){if(failProgress)return route.fulfill({status:503,contentType:'application/json',body:'{"error":"UNAVAILABLE"}'});data={xp:248,level:2,medals,nextMedal:medals[3],streak:{current:4}};}
 else if(url.pathname==='/api/me')data={user:profile};
 else if(url.pathname==='/api/profile'&&method==='PATCH'){const body=route.request().postDataJSON();profile={...profile,display_name:body.displayName,language:body.language};saveCount++;data={user:profile};}
 else if(url.pathname==='/api/sightings'&&method==='POST'){captureCount++;await new Promise(r=>setTimeout(r,350));data={status:'accepted',catType:'Calico',validation:{catConfidence:.96}};}
 else if(url.pathname==='/api/sightings')data={sightings:[sighting]};
 else if(url.pathname==='/api/map')data={clusters:[{area:sighting.area,count:1,sample:sighting}]};
 else if(url.pathname==='/api/capture-sessions')data={sessionId:'qa-session'};
 else if(url.pathname==='/api/care-flags')data={flags:[]};
 else if(url.pathname==='/api/config')data={};
 await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
});
try{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  for(const match of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)){if(!/type=['"](?:module|application\/ld\+json)/.test(match[1]))new Function(match[2]);}
  await page.goto(origin+'/?ui=reference-1#app',{waitUntil:'domcontentloaded'});
  await page.locator('.pw-home').waitFor();
  await page.waitForTimeout(1800);
  assert.equal(await page.locator('[data-streak-summary]').innerText(),'4 day streak');
  await page.locator('.map-pin.has-photo').first().waitFor();await page.locator('.map-pin.has-photo').first().click();await page.locator('.maplibregl-popup').waitFor();
  await page.locator('.maplibregl-popup-close-button').click();
  for(let i=0;i<10;i++)await page.locator('button[aria-label="Zoom in"]').click();
  await page.waitForFunction(()=>document.querySelector('.app-map').classList.contains('map-zoom-close'));
  assert.equal(await page.locator('.map-pin.has-photo img').first().evaluate(el=>getComputedStyle(el).opacity),'1');
  for(let i=0;i<7;i++)await page.locator('button[aria-label="Zoom out"]').click();
  await page.waitForTimeout(1200);
  await page.screenshot({path:fileURLToPath(new URL('home-390.png',out)),fullPage:true});
  for(const screen of ['journal','profile']){
    await page.locator('.mobile-nav [data-screen='+screen+']').first().click();
    await page.locator('.pw-'+screen).waitFor();await page.waitForTimeout(900);
    await page.screenshot({path:fileURLToPath(new URL(screen+'-390.png',out)),fullPage:true});
  }
  await page.locator('.mobile-nav .mobile-capture').first().click();await page.locator('#captureModal.open').waitFor();
  await page.screenshot({path:fileURLToPath(new URL('capture-390.png',out))});
  await page.locator('#captureModal [aria-label="Close camera"]').click();await page.locator('#captureModal').waitFor({state:'hidden'});
  const nav=screen=>page.locator((page.viewportSize().width<=900?'.app-main>.mobile-nav':'.app-sidebar')+' [data-screen='+screen+']');
  await nav('journal').click();await page.locator('#journalEntries .pw-entry').first().waitFor();
  assert.equal(await page.locator('#journalEntries .pw-entry').count(),5);
  await page.locator('[data-journal-page=next]').click();assert.equal(await page.locator('#journalEntries .pw-entry').count(),3);
  await page.locator('[data-journal-filter=common]').click();assert.equal(await page.locator('#journalEntries .pw-entry').count(),2);
  await page.locator('[data-journal-filter=rare]').click();assert.equal(await page.locator('#journalEntries .pw-entry').count(),4);
  await page.locator('#journalEntries .pw-entry').first().click();await page.locator('#journalDetailModal.is-open').waitFor();
  assert.match(await page.locator('.journal-detail-description').innerText(),/calm cat/);
  assert.equal(await page.locator('.journal-detail-photo').count(),1);
  await page.keyboard.press('Escape');await page.locator('#journalDetailModal').waitFor({state:'detached'});
  await nav('profile').click();await page.locator('.profile-xp-total').waitFor();
  assert.equal(await page.locator('.profile-achievements>.profile-medal-grid>.profile-medal-item').count(),4);
  assert.match(await page.locator('.profile-next-medal').innerText(),/2 XP to Night Watcher/);
  const boxes=await page.evaluate(()=>{const box=s=>document.querySelector(s).getBoundingClientRect();return {xp:box('.profile-progress-card').top,medals:box('.profile-achievement-head').top};});assert.ok(boxes.xp<boxes.medals);
  await page.locator('button[data-ui-theme]').click();assert.equal(await page.locator('html').getAttribute('data-ui-theme'),'dark');
  await page.screenshot({path:fileURLToPath(new URL('profile-dark-390.png',out)),fullPage:true});
  await page.locator('button[data-ui-theme]').click();
  await page.locator('.pw-edit-profile:has(#profileForm)>summary').click();
  await page.locator('#profileName').fill('Edited QA name');await page.locator('#profileForm button[type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('.profile-xp-total')?.textContent==='248 XP');
  assert.equal(saveCount,1);assert.equal(profile.display_name,'Edited QA name');
  // Permission-denied feedback must recover to an enabled shutter.
  await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError')};});
  await page.locator('.app-main>.mobile-nav .mobile-capture').click();await page.locator('#confirmCapture').click();
  await page.waitForFunction(()=>document.getElementById('pwCaptureStatus').dataset.state==='error');
  assert.match(await page.locator('#captureHelp').innerText(),/Camera is blocked/);assert.equal(await page.locator('#confirmCapture').isDisabled(),false);
  // Synthetic camera stream and location are test fixtures only. No real camera or AI call.
  await context.grantPermissions(['geolocation']);await context.setGeolocation({latitude:14.42,longitude:121.03});
  await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;const ctx=canvas.getContext('2d');ctx.fillStyle='#ffb400';ctx.fillRect(0,0,640,480);const stream=canvas.captureStream(10);window.__qaStream=stream;return stream;};});
  await page.locator('#confirmCapture').click();await page.waitForFunction(()=>document.getElementById('confirmCapture').dataset.ready==='1'&&document.getElementById('cameraVideo').videoWidth>0);
  await page.locator('#sightingDescription').fill('QA fixture of a calm cat resting in the shade.');
  await page.evaluate(()=>{document.getElementById('confirmCapture').click();document.getElementById('confirmCapture').click();});
  await page.waitForFunction(()=>document.getElementById('pwCaptureStatus').dataset.state==='accepted');assert.equal(captureCount,1);
  assert.match(await page.locator('#pwCaptureStatus').innerText(),/Calico · 96%/);
  await page.locator('#captureModal').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>window.__qaStream.getTracks().every(t=>t.readyState==='ended')),true);
  failJournal=true;await nav('journal').click();await page.getByRole('button',{name:'Retry Journal'}).waitFor();failJournal=false;await page.getByRole('button',{name:'Retry Journal'}).click();await page.locator('#journalEntries .pw-entry').first().waitFor();
  failProgress=true;await nav('profile').click();await page.getByRole('button',{name:'Retry medals'}).waitFor();failProgress=false;await page.getByRole('button',{name:'Retry medals'}).click();await page.locator('.profile-xp-total').waitFor();
  for(const width of [360,390,760,768,1280]){
    await page.setViewportSize({width,height:844});
    for(const screen of ['home','journal','profile','care']){
      await nav(screen).click();await page.waitForTimeout(300);
      const overflow=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,panels:[...document.querySelectorAll('#dashboard')].map(el=>el.scrollWidth>el.clientWidth+1)}));
      assert.ok(overflow.document<=width+1&&overflow.body<=width+1&&!overflow.panels.some(Boolean),`${screen} at ${width}px overflows: ${JSON.stringify(overflow)}`);
      if(screen==='profile')await page.locator('.profile-xp-total').waitFor();
    }
    console.log('PASS responsive screens at '+width+'px');
  }
  await page.setViewportSize({width:360,height:800});await nav('home').click();await page.locator('#captureBtn').click();
  const captureOverflow=await page.locator('#captureModal').evaluate(el=>el.scrollWidth>el.clientWidth+1);assert.equal(captureOverflow,false);
  await page.locator('#captureModal').evaluate(el=>el.scrollTop=el.scrollHeight);
  await page.screenshot({path:fileURLToPath(new URL('capture-bottom-360.png',out))});
  await page.keyboard.press('Escape');await page.locator('#captureModal').waitFor({state:'hidden'});
  assert.deepEqual(errors,[]);console.log('PASS navigation, Journal pagination/filters/details, medals, theme, profile save, permissions, single capture, track cleanup, error/retry; no uncaught browser errors.');
}finally{await browser.close();}
