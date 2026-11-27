// Run against a running local server or APP_TEST_URL in a fresh browser context.
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

export async function verifyService(page, origin) {
  const check = (value, message) => {
    if (!value) throw Error(message);
  };
  const errors = [];
  const visit = async (route) => {
    await page.goto(origin.replace(/\/$/, '') + '/#/' + route);
  };
  const button = (name) => page.getByRole('button', { name, exact: true });
  const heading = (name) => page.getByRole('heading', { name, exact: true });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await visit('closet');
  await button('크롭 트렌치').waitFor();
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      '가로 넘침 ' + width,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await button('옷 등록').click();
  const files = [];
  for (const [i, color] of ['#34445a', '#c8b1ad'].entries()) {
    const encoded = await page.evaluate((color) => {
      const c = document.createElement('canvas');
      c.width = 120;
      c.height = 180;
      const ctx = c.getContext('2d');
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 120, 180);
      return c.toDataURL('image/png').split(',')[1];
    }, color);
    files.push({
      name: 'qa-' + i + '.png',
      mimeType: 'image/png',
      buffer: Buffer.from(encoded, 'base64'),
    });
  }
  const choose = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /앨범에서 선택/ }).click();
  await (await choose).setFiles(files);
  for (const [name, category] of [
    ['검증 재킷', '아우터'],
    ['검증 셔츠', '상의'],
  ]) {
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('img', { name: '등록할 의류' }).waitFor();
    await sheet.getByLabel('의류 이름').fill(name);
    await sheet.getByLabel('분류', { exact: true }).selectOption(category);
    await sheet.getByRole('button', { name: '옷장에 저장' }).click();
    if (category === '아우터') await sheet.getByText(/사진 2 \/ 2/).waitFor();
  }
  await button('검증 재킷').click();
  await heading('검증 재킷').waitFor();
  await button('코디에 담기').click();
  await button('검증 셔츠').click();
  await button('코디 저장').click();
  await page.getByLabel('코디 이름').fill('출근 조합');
  await button('저장하기').click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await visit('saved');
  await page.getByRole('button', { name: /출근 조합/ }).click();
  for (const name of ['검증 셔츠', '검증 재킷'])
    await button(name + ' 코디에서 빼기').waitFor();
  await page.reload();
  await button('검증 재킷 코디에서 빼기').waitFor();
  await visit('purchase-link');
  await page
    .getByLabel('상품 링크', { exact: true })
    .fill('https://example.com/qa-piece');
  await page.getByLabel('상품 이름').fill('링크 구매품');
  await button('옷장에 등록').click();
  await heading('링크 구매품').waitFor();
  await page.getByRole('link', { name: /판매처 열기/ }).waitFor();
  await visit('purchases');
  await page.getByRole('button', { name: /이메일 주문서/ }).click();
  await page.getByRole('checkbox').check();
  await page
    .getByLabel('주문 이메일 파일')
    .setInputFiles({
      name: 'sample-order.eml',
      mimeType: 'message/rfc822',
      buffer: Buffer.from(
        'Subject: receipt\nContent-Type: text/plain; charset=UTF-8\n\nBlue jacket',
      ),
    });
  await page.getByText(/Blue jacket/).waitFor();
  await page.getByLabel('상품 이름').fill('이메일 구매품');
  await button('옷장에 등록').click();
  await heading('이메일 구매품').waitFor();
  await visit('purchases');
  await page.getByRole('button', { name: /승인 쇼핑몰/ }).click();
  await page.getByRole('checkbox').check();
  await button('샘플 주문으로 체험').click();
  await page.getByRole('checkbox', { name: /크롭 트렌치/ }).check();
  await button('선택한 1건 확인').click();
  await button('샘플 구매 내역에 담기').click();
  await heading('가져온 샘플 주문').waitFor();
  await page.getByRole('button', { name: /이메일 주문서/ }).click();
  await page.getByRole('checkbox').check();
  await button('샘플 주문으로 체험').click();
  check(
    await page.getByRole('checkbox', { name: /크롭 트렌치/ }).isDisabled(),
    '채널 간 중복 방지',
  );
  await visit('closet');
  await button('크롭 트렌치').waitFor();
  check((await button('검증 재킷').count()) === 0, '샘플·개인 옷장 격리');
  await page
    .locator('.wc-switch')
    .getByRole('button', { name: '개인 옷장' })
    .click();
  await button('검증 재킷').waitFor();
  await button('이메일 구매품').waitFor();
  check((await button('크롭 트렌치').count()) === 0, '개인 데이터에 샘플 유입');
  check(!errors.length, '페이지 오류 ' + errors.join(', '));
  return 'PASS: 4 sizes, multi-image import, real outfit save/reopen, purchase link, selected .eml, sample store consent + cross-channel dedupe, mode isolation.';
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    console.log(
      await verifyService(
        page,
        process.env.APP_TEST_URL ?? 'http://127.0.0.1:5173',
      ),
    );
  } finally {
    await browser.close();
  }
}
