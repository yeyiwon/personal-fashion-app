import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';

export async function verifyInterface(page, origin) {
  const button = (name) => page.getByRole('button', { name, exact: true });
  const open = async (route) => {
    await page.goto(origin + '/\#/' + route);
    await page.getByRole('heading', { level: 1 }).first().waitFor();
  };
  const verify = (value, message) => {
    if (!value) throw Error(message);
  };
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open('home');
  await button('와인 슬립 드레스 살펴보기').click();
  await button('와인 슬립 드레스 코디에 놓기').click();
  await button('와인 슬립 드레스 코디에서 빼기').waitFor();
  await open('home');
  const bag = button('에스프레소 숄더백 살펴보기');
  const point = await bag.boundingBox();
  verify(point, '가방 영역');
  const from = {
    x: point.x + point.width * 0.52,
    y: point.y + point.height * 0.55,
  };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x - 15, from.y - 12, { steps: 4 });
  const dest = await page.locator('[data-drop-room="fitting"]').boundingBox();
  verify(dest, '드래그 목적지');
  await page.mouse.move(dest.x + dest.width / 2, dest.y + dest.height / 2, {
    steps: 6,
  });
  await page.mouse.up();
  await button('에스프레소 숄더백 선택 해제').waitFor();

  await open('closet');
  await button('크롭 트렌치').click();
  await button('상세').waitFor();
  await button('다음 의류').click();
  await button('와인 슬립 드레스').click();
  await button('직접 코디').filter({ visible: true }).first().click();
  await button('와인 슬립 드레스 코디에서 빼기').waitFor();
  await open('closet');
  await button('목록').click();
  await page.getByRole('searchbox', { name: '의류 검색' }).fill('로퍼');
  await button('블랙 페니 로퍼').click();
  await page.getByRole('heading', { name: '블랙 페니 로퍼' }).waitFor();

  await open('model');
  await button('남성형').click();
  await button('허리 너비 조절').click();
  const figure = page.locator('.dress-form');
  const previous = await figure.innerHTML();
  const waist = page.getByRole('slider', { name: '허리 너비', exact: true });
  await waist.press('End');
  verify(
    (await waist.inputValue()) === '70' &&
      (await figure.innerHTML()) !== previous,
    '치수 변경 시 도식 반응',
  );
  await button('측면').click();
  verify((await figure.getAttribute('aria-label')).includes('90도'), '측면');
  await button('후면').click();
  verify((await figure.getAttribute('aria-label')).includes('180도'), '후면');
  await page.reload();
  await page.getByRole('img', { name: '남성형 기본 모델 착장 예시' }).waitFor();
  await button('허리 너비 조절').click();
  verify((await waist.inputValue()) === '70', '치수 다시 열기');
  await button('공간 이동').click();
  const nav = page.getByRole('navigation', { name: '공간과 작업' });
  await nav.getByRole('link', { name: '내 옷장' }).click();
  await page.getByRole('heading', { name: '내 옷장', exact: true }).waitFor();
  await button('공간 이동').click();
  await page.keyboard.press('Escape');
  verify(
    (await button('공간 이동').getAttribute('aria-expanded')) === 'false',
    '도크 Escape 닫기',
  );
  const dims = [];
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ['home', 'closet', 'model']) {
      await open(route);
      verify(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        route + ' overflow ' + width,
      );
      dims.push([width, route]);
    }
  }
  verify(!errors.length, '페이지 오류 ' + errors.join(','));
  return {
    checks: dims.length,
    garmentDrop: true,
    garmentDrawer: true,
    modelPersisted: true,
    dockNavigation: true,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    });
    console.log(
      await verifyInterface(
        await context.newPage(),
        process.env.APP_TEST_URL ?? 'http://127.0.0.1:5188',
      ),
    );
  } finally {
    await browser.close();
  }
}
