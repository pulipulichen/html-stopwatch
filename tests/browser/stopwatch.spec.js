import {test,expect} from '@playwright/test';
test('keyboard, editing, compact title, popup synchronization and clipboard',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 await page.goto('./');
 await expect(page).toHaveTitle('00:00 - HTML Stopwatch');
 await page.keyboard.press('Space');
 await expect(page.locator('#toggle')).toHaveText('暫停');
 await expect.poll(()=>page.locator('#fraction').textContent()).not.toBe('.000');
 await page.keyboard.press('Space');
 await expect(page.locator('#toggle')).toHaveText('開始');
 const frozen=await page.locator('#timer').textContent();
 await page.waitForTimeout(200);
 expect(await page.locator('#timer').textContent()).toBe(frozen);
 await page.locator('#title-button').click();
 await page.locator('#title-input').fill('Meeting');
 await page.keyboard.press('Escape');
 await expect(page.locator('#title-text')).toHaveText('HTML Stopwatch');
 expect(await page.locator('#timer').textContent()).toBe(frozen);
 await page.locator('#title-button').click();
 await page.locator('#title-input').fill('Meeting');
 await page.keyboard.press('Space');
 await expect(page.locator('#toggle')).toHaveText('開始');
 await page.keyboard.press('Enter');
 await expect(page).toHaveTitle(/ - Meeting$/);
 const [popup]=await Promise.all([page.waitForEvent('popup'),page.locator('#popup').click()]);
 await popup.waitForLoadState();
 await expect(popup.locator('#title-text')).toHaveText('Meeting');
 await popup.locator('#reset').click();
 await expect(page.locator('#timer')).toHaveText('00:00:00.000');
 await popup.locator('#title-button').click();
 await popup.locator('#title-input').fill('Shared title');
 await popup.keyboard.press('Enter');
 await expect(page.locator('#title-text')).toHaveText('Shared title');
 await popup.locator('#toggle').click();
 await expect(page.locator('#toggle')).toHaveText('暫停');
 await page.reload();
 await expect(page.locator('#toggle')).toHaveText('暫停');
 await page.locator('#toggle').click();
 await expect(page.locator('#toggle')).toHaveText('開始');
 await page.locator('#copy').click();
 const copied=await page.evaluate(()=>navigator.clipboard.readText());
 expect(copied).toMatch(/^Shared title\t\d{2}:\d{2}\.\d{3}$/);
 await page.keyboard.press('Escape');
 await expect(popup.locator('#timer')).toHaveText('00:00:00.000');
});
test('narrow layout, overflow-only marquee, manifest and no offline cache',async({page})=>{
 await page.setViewportSize({width:220,height:220});await page.goto('./');
 await expect.poll(()=>page.locator('#title-track').evaluate(el=>el.getAnimations().length)).toBe(0);
 await page.locator('#title-button').click();
 await page.locator('#title-input').fill('This is a very long meeting title which must move within its own area');
 await page.keyboard.press('Enter');
 await expect.poll(()=>page.locator('#title-track').evaluate(el=>el.getAnimations().length)).toBe(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.setViewportSize({width:600,height:220});
 await page.locator('#title-button').click();await page.locator('#title-input').fill('Short');
 await page.locator('#reset').click();
 await expect(page.locator('#title-text')).toHaveText('Short');
 await expect.poll(()=>page.locator('#title-track').evaluate(el=>el.getAnimations().length)).toBe(0);
 const manifest=await page.evaluate(async()=> (await fetch('./manifest.webmanifest')).json());
 expect(manifest.start_url).toBe('./');expect(manifest.display).toBe('standalone');
 for(const icon of manifest.icons){const response=await page.request.get(icon.src);expect(response.ok()).toBe(true);}
 expect(await page.evaluate(()=>navigator.serviceWorker.getRegistrations().then(r=>r.length))).toBe(0);
 expect(await page.evaluate(()=>caches.keys())).toEqual([]);
});

test('mini uses bounded startup corrections and does not resize on content changes',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 await context.addInitScript(()=>{
  window.resizeCalls=[];
  window.resizeTo=(...args)=>window.resizeCalls.push(['resizeTo',...args]);
  window.resizeBy=(...args)=>window.resizeCalls.push(['resizeBy',...args]);
 });
 await page.goto('./');
 const [popup]=await Promise.all([page.waitForEvent('popup'),page.locator('#popup').click()]);
 await popup.waitForLoadState();
 await popup.setViewportSize({width:220,height:128});
 const bodyHeight=await popup.locator('body').evaluate(el=>el.getBoundingClientRect().height);
 expect(bodyHeight).toBeLessThanOrEqual(128);
 expect(bodyHeight).toBeGreaterThan(120);
 await expect(popup.locator('#timer')).toHaveCSS('font-size','24px');
 await popup.locator('#copy').click();
 await expect(popup.locator('#status')).toHaveText('已複製');
 expect(await popup.locator('body').evaluate(el=>el.getBoundingClientRect().height)).toBe(bodyHeight);
 await expect(popup.locator('#status')).toBeEmpty({timeout:5000});
 expect(await popup.locator('body').evaluate(el=>el.getBoundingClientRect().height)).toBe(bodyHeight);
 // A wider viewport must not change the intended compact font or trigger a resize loop.
 await popup.setViewportSize({width:600,height:128});
 await expect(popup.locator('#timer')).toHaveCSS('font-size','24px');
 await popup.waitForTimeout(250);
 const calls=await popup.evaluate(()=>window.resizeCalls);
 expect(calls.length).toBeLessThanOrEqual(2);
 for(const [method,width,height] of calls) {
  expect(method).toBe('resizeTo');
  expect(width).toBeGreaterThanOrEqual(180);
  expect(width).toBeLessThanOrEqual(560);
  expect(height).toBeGreaterThanOrEqual(128);
  expect(height).toBeLessThanOrEqual(340);
 }
});

test('native popup recovers when the initial requested size is ignored',async({browser})=>{
 const context=await browser.newContext({viewport:null});
 try {
  const page=await context.newPage();
  await page.addInitScript(()=>{
   const open=window.open.bind(window);
   window.open=(url,target,features)=>open(url,target,features.replace(/width=\\d+/, 'width=1000').replace(/height=\\d+/, 'height=600'));
  });
  await page.goto('http://127.0.0.1:4173/html-stopwatch/');
  const [popup]=await Promise.all([page.waitForEvent('popup'),page.locator('#popup').click()]);
  await popup.waitForLoadState();
  await expect.poll(()=>popup.evaluate(()=>innerWidth)).toBeLessThanOrEqual(320);
  await expect.poll(()=>popup.evaluate(()=>innerHeight)).toBeLessThanOrEqual(200);
  expect(await popup.locator('body').evaluate(el=>el.getBoundingClientRect().height)).toBeLessThanOrEqual(await popup.evaluate(()=>innerHeight));
 } finally {await context.close();}
});
