// Run against an already running local service in a fresh, disposable browser context.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const origin = process.env.APP_TEST_URL ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto(origin);
  await page.getByText('아직 등록한 옷이 없어요').waitFor();
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const files = [];
  for (const [index, color] of ['#665544', '#a99888'].entries()) {
    const bytes = await page.evaluate((value) => {
      const c = document.createElement('canvas');
      c.width = 180;
      c.height = 240;
      const g = c.getContext('2d');
      g.fillStyle = value;
      g.fillRect(0, 0, 180, 240);
      return c.toDataURL('image/png').split(',')[1];
    }, color);
    files.push({
      name: 'qa-' + index + '.png',
      mimeType: 'image/png',
      buffer: Buffer.from(bytes, 'base64'),
    });
  }
  await page.getByRole('button', { name: '옷 등록', exact: true }).click();
  const choose = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '앨범에서 선택' }).click();
  await (await choose).setFiles(files);
  for (const [name, category] of [
    ['검증 재킷', '아우터'],
    ['검증 셔츠', '상의'],
  ]) {
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('의류 이름').fill(name);
    await dialog.getByLabel('분류').selectOption(category);
    await dialog.getByRole('button', { name: '옷장에 저장' }).click();
    await page
      .getByRole('button', { name, exact: true })
      .waitFor({ state: 'attached' });
  }
  await page.getByRole('button', { name: '검증 재킷', exact: true }).click();
  await page.getByRole('button', { name: '코디에 담기' }).click();
  await page.getByRole('button', { name: '검증 셔츠', exact: true }).click();
  await page.getByRole('button', { name: '코디 저장', exact: true }).click();
  await page.getByLabel('코디 이름').fill('출근 조합');
  await page.getByRole('button', { name: '저장하기' }).click();
  await page.getByRole('button', { name: '저장한 코디 1' }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: '검증 재킷', exact: true }).waitFor();
  await page.getByRole('button', { name: '코디', exact: true }).click();
  await page.getByRole('button', { name: '저장한 코디 1' }).click();
  await page.getByRole('button', { name: /출근 조합/ }).click();
  for (const name of ['검증 셔츠', '검증 재킷'])
    await page.getByRole('button', { name: name + ' 코디에서 빼기' }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    'PASS · 4 viewport widths, 2 real image imports, stored and reopened outfit, zero page errors'
  );
} finally {
  await browser.close();
}
