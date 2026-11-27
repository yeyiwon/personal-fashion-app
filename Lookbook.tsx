import { Choice, Control } from './LiquidControls';
import { useState } from 'react';
import { useStudio, type PageProps, type StudioGarment } from './studio';
import { getImage } from './storage';
import { GarmentPhoto, Icon } from './presentation';
import { type Outfit } from './domain';

async function loadPiece(item: StudioGarment) {
  if (item.photoUnavailable) return null;
  const blob = item.image ? null : await getImage(item.id);
  const source = item.image ?? (blob ? URL.createObjectURL(blob) : null);
  if (!source) return null;
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    return image;
  } finally {
    if (blob) URL.revokeObjectURL(source);
  }
}
async function renderPoster(
  look: Outfit,
  items: StudioGarment[],
  sample: boolean,
) {
  const canvas = document.createElement('canvas');
  const width = 840,
    columns = items.length > 1 ? 2 : 1;
  const rows = Math.ceil(items.length / columns),
    cellHeight = 235;
  canvas.width = width;
  canvas.height = 195 + rows * cellHeight + 55;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error('룩북 이미지를 만들 수 없어요.');
  await document.fonts.ready;
  ctx.fillStyle = '#f4f6f7';
  ctx.fillRect(0, 0, width, canvas.height);
  ctx.fillStyle = '#232d39';
  ctx.font = '54px Instrument, Georgia';
  ctx.fillText('BELLO', 34, 64);
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText(look.name, 34, 128, width - 68);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#566372';
  ctx.fillText(
    (sample ? '샘플 옷장' : '내 옷장') + '  /  ' + items.length + '벌',
    34,
    163,
  );
  for (let i = 0; i < items.length; i++) {
    const g = items[i],
      cell = (width - 68) / columns,
      x = 34 + (i % columns) * cell,
      y = 185 + Math.floor(i / columns) * cellHeight;
    const img = await loadPiece(g);
    ctx.fillStyle = '#e6eaed';
    ctx.fillRect(x + 3, y + 3, cell - 6, cellHeight - 42);
    if (img) {
      const scale = Math.min(
        (cell - 35) / img.naturalWidth,
        (cellHeight - 67) / img.naturalHeight,
      );
      const w = img.naturalWidth * scale,
        h = img.naturalHeight * scale;
      ctx.drawImage(
        img,
        x + (cell - w) / 2,
        y + (cellHeight - 36 - h) / 2,
        w,
        h,
      );
    } else {
      ctx.fillStyle = g.color;
      ctx.fillRect(x + cell / 2 - 20, y + 58, 40, 40);
    }
    ctx.fillStyle = '#232d39';
    ctx.font = '19px sans-serif';
    ctx.fillText(g.name, x + 5, y + cellHeight - 12, cell - 12);
  }
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error('이미지를 저장할 수 없어요.'))),
      'image/jpeg',
      0.9,
    ),
  );
  return new File([blob], 'wardrobe-look.jpg', { type: blob.type });
}
export default function Lookbook({ go }: PageProps) {
  const { mode, outfits, garments, notify } = useStudio();
  const [id, choose] = useState(''),
    [busy, work] = useState(false),
    [file, setFile] = useState<{ key: string; file: File } | null>(null);
  const look = outfits.find((o) => o.id === id) ?? outfits[0];
  const items = (look?.garmentIds ?? []).flatMap((i) =>
    garments.filter((g) => g.id === i),
  );
  const key =
    mode +
    '-' +
    look?.id +
    '-' +
    look?.updatedAt +
    '-' +
    items.map((g) => g.updatedAt).join('-');
  const output = file?.key === key ? file.file : null;
  async function make() {
    if (!look || busy) return;
    work(true);
    try {
      setFile({
        key,
        file: await renderPoster(look, items, mode === 'sample'),
      });
    } catch (e) {
      notify(e instanceof Error ? e.message : '룩북 이미지를 만들지 못했어요.');
    } finally {
      work(false);
    }
  }
  function save() {
    if (!output) return;
    const u = URL.createObjectURL(output),
      a = document.createElement('a');
    a.href = u;
    a.download = output.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 60000);
  }
  async function share() {
    if (output)
      try {
        await navigator.share({ files: [output] });
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError'))
          notify('공유할 앱을 열지 못했어요.');
      }
  }
  return (
    <section className="book">
      <h1>나의 룩북</h1>
      {!look ? (
        <>
          <p>코디를 저장하면 한 장의 룩북으로 내보낼 수 있어요.</p>
          <Control className="action" onClick={() => go('direct')}>
            코디 만들기
          </Control>
        </>
      ) : (
        <>
          <label>
            룩북으로 만들 코디
            <Choice value={look.id} onChange={(e) => choose(e.target.value)}>
              {outfits.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Choice>
          </label>
          <div className="look-print">
            <strong>BELLO</strong>
            <h2>{look.name}</h2>
            <p>
              {mode === 'sample' ? '샘플 옷장' : '내 옷장'} / {items.length}벌
            </p>
            <div>
              {items.map((g) => (
                <figure key={g.id}>
                  <GarmentPhoto item={g} />
                  <figcaption>{g.name}</figcaption>
                </figure>
              ))}
            </div>
          </div>
          <div className="book-actions">
            {output ? (
              <>
                <Control className="action" onClick={save}>
                  룩북 이미지 저장
                </Control>
                {navigator.canShare?.({ files: [output] }) && (
                  <Control className="quiet" onClick={share}>
                    공유할 앱 선택 <Icon name="diagonal" size={15} />
                  </Control>
                )}
              </>
            ) : (
              <Control
                className="action"
                disabled={busy}
                onClick={() => void make()}
              >
                {busy ? '이미지 만드는 중…' : '룩북 이미지 만들기'}
              </Control>
            )}
          </div>
        </>
      )}
    </section>
  );
}
