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
  const bag = button('에스프레소 숄더백 입히기');
  const from = await bag.boundingBox();
  const dest = await page.locator('.avatar-floor canvas').first().boundingBox();
  verify(from && dest, '의류·모델 드롭 영역');
  const x = from.x + from.width / 2,
    y = from.y + from.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 18, y, { steps: 4 });
  await page.mouse.move(dest.x + dest.width / 2, dest.y + dest.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
  await page.locator('.look-label').click();
  const lock = button('에스프레소 숄더백 고정');
  await lock.click();
  verify(
    await button('에스프레소 숄더백 벗기기').isDisabled(),
    '고정한 의류 보호',
  );
  await lock.click();
  await button('드레스룸 도구 닫기').click();
  await button('착장 저장').click();
  await button('저장됨').waitFor();
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

  await open('model-study');
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
  const atlas = page.getByRole('dialog', { name: '공간 이동' });
  await atlas.getByRole('searchbox').fill('내 옷장');
  await atlas.getByRole('button', { name: '내 옷장', exact: true }).click();
  await page.getByRole('heading', { name: '내 옷장', exact: true }).waitFor();
  await button('공간 이동').click();
  await page.keyboard.press('Escape');
  verify(!(await atlas.isVisible()), '공간 닫기');
  await open('shop');
  const budget = page.getByRole('combobox', { name: '최대 가격' });
  await budget.press('Enter');
  await page
    .getByRole('listbox')
    .getByRole('option', { name: '8만원 이하' })
    .click();
  verify((await budget.inputValue()) === '80000', '가격 필터 이벤트');
  await budget.press('Enter');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  verify((await budget.inputValue()) === '100000', '선택창 키보드 조작');
  const dims = [];
  for (const width of [320, 375, 390, 430, 768, 1280]) {
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
    closetSearch: true,
    modelPersisted: true,
    spaceNavigation: true,
    opticalSelect: true,
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
