import {test, expect} from '@playwright/test';
import {HISTORY_PREFIX} from '../../history.js';

test.use({timezoneId: 'Asia/Taipei'});

const savedHistory = page => page.evaluate(prefix => Object.keys(localStorage)
  .filter(key => key.startsWith(prefix)).map(key => JSON.parse(localStorage.getItem(key))), HISTORY_PREFIX);
const rows = page => page.locator('#history-list > li');
async function openHistory(page) { await page.locator('#history-open').click(); }
async function openPopup(page) {
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.locator('#popup').click()]);
  await popup.waitForLoadState();
  return popup;
}
async function pauseAfterStarting(page) {
  await page.locator('#toggle').click();
  await expect(page.locator('#toggle')).toHaveText('暫停');
  await expect.poll(() => page.locator('#fraction').textContent()).not.toBe('.000');
  await page.locator('#toggle').click();
  await expect(page.locator('#toggle')).toHaveText('開始');
}

test('button pause/reset record once, preserve duration and title snapshots, and survive reopening', async ({page, context}) => {
  await page.goto('./');
  await page.locator('#reset').click();
  expect(await savedHistory(page)).toEqual([]);
  await page.locator('#title-button').click();
  await page.locator('#title-input').fill('Meeting');
  await page.keyboard.press('Enter');
  const before = Date.now();
  await pauseAfterStarting(page);
  const [pause] = await savedHistory(page);
  expect(pause).toMatchObject({title: 'Meeting', action: 'pause'});
  expect(pause.elapsedMs).toBeGreaterThan(0);
  expect(Number.isInteger(pause.elapsedMs)).toBe(true);
  expect(Date.parse(pause.recordedAt)).toBeGreaterThanOrEqual(before);
  expect(Date.parse(pause.recordedAt)).toBeLessThanOrEqual(Date.now());
  const frozen = await page.locator('#timer').textContent();
  await page.locator('#title-button').click();
  await page.locator('#title-input').fill('Next meeting');
  await page.keyboard.press('Enter');
  await page.locator('#reset').click();
  await expect(page.locator('#timer')).toHaveText('00:00:00.000');
  await page.locator('#reset').click();
  const records = await savedHistory(page);
  expect(records).toHaveLength(2);
  const reset = records.find(record => record.action === 'reset');
  expect(reset).toMatchObject({title: 'Next meeting', elapsedMs: pause.elapsedMs});
  expect(reset.id).not.toBe(pause.id);
  expect(records.find(record => record.action === 'pause').title).toBe('Meeting');
  await openHistory(page);
  await expect(page.locator('.history-action')).toHaveText(['重設', '暫停']);
  await expect(page.locator('.history-duration')).toHaveText([frozen.slice(3), frozen.slice(3)]);
  await expect(page.locator('.history-entry time').first()).toHaveText(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  await page.reload(); await openHistory(page);
  await expect(rows(page)).toHaveCount(2);
  const reopened = await context.newPage();
  await page.close(); await reopened.goto('./'); await openHistory(reopened);
  await expect(rows(reopened)).toHaveCount(2);
});

test('keyboard operations record once and history dialog keys do not reset or toggle the timer', async ({page}) => {
  await page.goto('./');
  await page.keyboard.press('Space');
  await expect(page.locator('#toggle')).toHaveText('暫停');
  expect(await savedHistory(page)).toHaveLength(0);
  await expect.poll(() => page.locator('#fraction').textContent()).not.toBe('.000');
  await page.keyboard.press('Space');
  await expect.poll(async () => (await savedHistory(page)).length).toBe(1);
  const frozen = await page.locator('#timer').textContent();
  await page.locator('#history-open').focus(); await page.keyboard.press('Space');
  await expect(page.locator('#history-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#history-dialog')).not.toBeVisible();
  await expect(page.locator('#timer')).toHaveText(frozen);
  expect(await savedHistory(page)).toHaveLength(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('#timer')).toHaveText('00:00:00.000');
  await page.keyboard.press('Escape');
  expect(await savedHistory(page)).toHaveLength(2);
  await page.locator('#timer').click(); await page.keyboard.press('Space');
  await expect(page.locator('#toggle')).toHaveText('暫停');
  expect(await savedHistory(page)).toHaveLength(2);
});

test('popup actions, single deletion, cancelled clear and confirmed clear synchronize live', async ({page, context}) => {
  await page.goto('./');
  const popup = await openPopup(page), other = await context.newPage();
  await other.goto('./');
  await expect(popup.locator('#history-open')).toBeHidden();
  await openHistory(page); await openHistory(other);
  await expect(page.locator('#history-empty')).toBeVisible();
  await pauseAfterStarting(popup);
  await expect(rows(page)).toHaveCount(1); await expect(rows(other)).toHaveCount(1);
  await other.locator('.history-entry button').click();
  await expect(rows(page)).toHaveCount(0);
  await popup.locator('#reset').click();
  await expect(rows(page)).toHaveCount(1); await expect(rows(other)).toHaveCount(1);
  await pauseAfterStarting(popup);
  await expect(rows(page)).toHaveCount(2); await expect(rows(other)).toHaveCount(2);
  other.once('dialog', dialog => dialog.dismiss()); await other.locator('#history-clear').click();
  await expect(rows(page)).toHaveCount(2);
  const frozen = await popup.locator('#timer').textContent();
  other.once('dialog', dialog => dialog.accept()); await other.locator('#history-clear').click();
  await expect(rows(page)).toHaveCount(0); await expect(rows(other)).toHaveCount(0);
  await expect(page.locator('#history-empty')).toBeVisible();
  await expect(page.locator('#history-clear')).toBeDisabled();
  await expect(popup.locator('#timer')).toHaveText(frozen);
  expect(await savedHistory(page)).toHaveLength(0);
});

test('malformed data is ignored; local dates, long titles and hour durations display safely at 220px', async ({page}) => {
  await page.setViewportSize({width: 220, height: 320});
  await page.goto('./');
  const title = '<img src=x onerror=alert(1)>' + '長標題'.repeat(100);
  await page.evaluate(({prefix, title}) => {
    localStorage.setItem(prefix + 'bad-json', '{');
    localStorage.setItem(prefix + 'bad-fields', JSON.stringify({id: 'bad-fields', title: 7}));
    localStorage.setItem(prefix + 'valid', JSON.stringify({id: 'valid', title,
      recordedAt: '2026-11-17T00:41:02.000Z', elapsedMs: 3723004, action: 'reset'}));
    localStorage.setItem('another-app', 'keep');
  }, {prefix: HISTORY_PREFIX, title});
  await openHistory(page);
  await expect(rows(page)).toHaveCount(1);
  await expect(page.locator('.history-title')).toHaveText(title);
  await expect(page.locator('.history-entry time')).toHaveText('2026-11-17 08:41:02');
  await expect(page.locator('.history-duration')).toHaveText('01:02:03.004');
  await expect(page.locator('#history-list img')).toHaveCount(0);
  expect(await page.locator('#history-dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.history-entry button').click();
  await expect(page.locator('#history-empty')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('another-app'))).toBe('keep');
});

for (const failure of ['blocked', 'quota']) {
  test(`${failure} storage keeps stopwatch controls and temporary history usable`, async ({page}) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(mode => {
      if (mode === 'blocked') {
        Object.defineProperty(window, 'localStorage', {get() { throw new DOMException('Blocked', 'SecurityError'); }});
      } else {
        localStorage.setItem('html-stopwatch:v1', JSON.stringify({elapsed: 72123, startedAt: null, title: 'Existing'}));
        Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
      }
    }, failure);
    await page.goto('./');
    await pauseAfterStarting(page);
    const frozen = await page.locator('#timer').textContent();
    await page.locator('#reset').click();
    await expect(page.locator('#timer')).toHaveText('00:00:00.000');
    await page.locator('#reset').click();
    await openHistory(page);
    await expect(rows(page)).toHaveCount(2);
    await expect(page.locator('.history-action')).toHaveText(['重設', '暫停']);
    await expect(page.locator('.history-duration')).toHaveText([frozen.slice(3), frozen.slice(3)]);
    await expect(page.locator('#history-warning')).toBeVisible();
    await page.locator('.history-entry button').first().click();
    await expect(rows(page)).toHaveCount(1);
    page.once('dialog', dialog => dialog.accept()); await page.locator('#history-clear').click();
    await expect(rows(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('failed popup saves still reach the main history through BroadcastChannel', async ({page, context}) => {
  await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {get() { throw new DOMException('Blocked', 'SecurityError'); }});
  });
  await page.goto('./'); const popup = await openPopup(page);
  await openHistory(page); await pauseAfterStarting(popup);
  await expect(rows(page)).toHaveCount(1);
  await popup.locator('#reset').click();
  await expect(rows(page)).toHaveCount(2);
  await expect(page.locator('#history-warning')).toBeVisible();
  await page.locator('.history-entry button').first().click();
  await expect(rows(page)).toHaveCount(1);
});

test('storage-event fallback supports concurrent appends and retains the newest 500', async ({page, context}) => {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'locks', {value: undefined});
    Object.defineProperty(window, 'BroadcastChannel', {value: undefined});
  });
  await page.goto('./'); const popup = await openPopup(page);
  await page.evaluate(prefix => {
    for (let i = 0; i < 500; i++) {
      const record = {id: `seed-${i}`, title: `Old ${i}`, recordedAt: new Date(1700000000000 + i * 1000).toISOString(), elapsedMs: 1234, action: 'pause'};
      localStorage.setItem(prefix + record.id, JSON.stringify(record));
    }
  }, HISTORY_PREFIX);
  await openHistory(page);
  const append = (target, id) => target.evaluate(async id => {
    const {createHistoryStore} = await import('./history.js');
    createHistoryStore().add({id, title: id, recordedAt: new Date().toISOString(), elapsedMs: 72123, action: 'reset'});
  }, id);
  await Promise.all([append(page, 'main-new'), append(popup, 'popup-new')]);
  await page.locator('#history-close').click(); await openHistory(page);
  await expect(rows(page)).toHaveCount(500);
  await expect(page.locator('.history-title', {hasText: 'main-new'})).toHaveCount(1);
  await expect(page.locator('.history-title', {hasText: 'popup-new'})).toHaveCount(1);
  const records = await savedHistory(page);
  expect(records).toHaveLength(500);
  expect(records.some(record => record.id === 'seed-0')).toBe(false);
  expect(records.some(record => record.id === 'seed-1')).toBe(false);
  await pauseAfterStarting(popup);
  await expect(page.locator('.history-title').first()).toHaveText('HTML Stopwatch');
  expect(await savedHistory(page)).toHaveLength(500);
});
