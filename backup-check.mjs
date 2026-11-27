// Run only in a fresh test browser context. Repeated imports retain existing data.
export async function verifyBackup(page, origin) {
  const visit = (route) => page.goto(origin.replace(/\/$/, '') + '/#/' + route);
  await visit('data');
  const switchMode = page.getByRole('button', {
    name: '개인 옷장의 백업 열기',
  });
  await page
    .getByRole('heading', { name: '데이터 관리', exact: true })
    .waitFor();
  if (await switchMode.count()) await switchMode.click();
  const input = page.getByLabel('옷장 백업 파일');
  const image = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 11;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#893452';
    ctx.fillRect(0, 0, 8, 11);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    );
    const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()),
      ),
      (v) => v.toString(16).padStart(2, '0'),
    ).join('');
    return { hash, original: canvas.toDataURL('image/png') };
  });
  const ids = await page.evaluate(() =>
    Array.from({ length: 5 }, () => crypto.randomUUID()),
  );
  const createdAt = new Date().toISOString(),
    updatedAt = createdAt;
  const fields = {
    condition: '착용 중',
    price: null,
    color: '#893452',
    createdAt,
    updatedAt,
  };
  const legacyGarment = {
    ...fields,
    id: ids[0],
    name: 'QA 이전 옷',
    category: '상의',
  };
  const legacy = {
    schemaVersion: 1,
    garments: [legacyGarment],
    outfits: [],
    images: [{ garmentId: ids[0], ...image }],
  };
  const buy = {
    ...fields,
    id: ids[2],
    name: 'QA 사진 없는 구매',
    category: '하의',
    photoUnavailable: true,
    purchase: {
      url: 'https://example.com/qa',
      shop: 'QA 스토어',
      purchasedAt: createdAt.slice(0, 10),
    },
  };
  const outfit = {
    id: ids[3],
    name: 'QA 복원 코디',
    garmentIds: [ids[1], ids[2]],
    createdAt,
    updatedAt,
  };
  const second = {
    schemaVersion: 1,
    garments: [
      { ...legacyGarment, id: ids[1], name: 'QA 새 ID 동일 사진' },
      buy,
    ],
    images: [{ garmentId: ids[1], ...image }],
    outfits: [outfit],
  };
  const put = async (value) =>
    input.setInputFiles({
      name: 'verified-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(value)),
    });
  await put(legacy);
  await page
    .getByText('의류 1벌과 코디 0개를 추가했어요.', { exact: true })
    .waitFor();
  await put(second);
  await page
    .getByText('의류 1벌과 코디 1개를 추가했어요.', { exact: true })
    .waitFor();
  await put(second);
  await page
    .getByText('의류 0벌과 코디 0개를 추가했어요.', { exact: true })
    .waitFor();
  await put({
    ...legacy,
    garments: [legacyGarment, { ...buy, id: ids[4] }],
    images: [{ garmentId: ids[0], ...image, hash: '0'.repeat(64) }],
  });
  await page.getByText(/백업의 파일 형식이나 구성 항목이 손상/).waitFor();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '사진과 코디 내보내기' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const archive = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const memberIds = archive.outfits.find((o) => o.id === outfit.id)?.garmentIds;
  if (JSON.stringify(memberIds) !== JSON.stringify([ids[0], ids[2]]))
    throw Error('동일 사진의 기존 ID로 코디 복원 실패');
  if (archive.garments.some((g) => [ids[1], ids[4]].includes(g.id)))
    throw Error('중복 또는 손상된 레코드가 추가됨');
  if (
    archive.images.find((i) => i.garmentId === ids[0])?.original !==
      image.original ||
    archive.garments.find((g) => g.id === buy.id)?.purchase?.url !==
      buy.purchase.url
  )
    throw Error('원본 또는 구매 정보 누락');
  return 'PASS: legacy photo import, hash-based deduplication, purchase-only garment, outfit member remap, idempotent retry, invalid digest rollback, exported original.';
}
