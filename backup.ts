import {
  garmentFields,
  itemName,
  outfitMembers,
  type Garment,
  type Outfit,
} from './domain';
import { prepareImage, type PreparedImage, MAX_IMAGE_BYTES } from './images';
import { mergeBackup } from './storage';

const uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;
function invalid(): never {
  throw Error(
    '옷장 백업의 파일 형식이나 구성 항목이 손상됐어요. 원본 JSON을 확인해 주세요.',
  );
}
function id(input: unknown): string {
  return typeof input === 'string' && uuid.test(input) ? input : invalid();
}
function date(input: unknown): string {
  return typeof input === 'string' &&
    input.length <= 32 &&
    Number.isFinite(Date.parse(input))
    ? input
    : invalid();
}
function bytesFromUrl(url: unknown) {
  if (
    typeof url !== 'string' ||
    url.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 64
  )
    invalid();
  const comma = url.indexOf(',');
  const mime = /^data:(image\/(?:jpeg|png|webp));base64$/.exec(
    url.slice(0, comma),
  )?.[1];
  if (!mime) invalid();
  const bytes = Uint8Array.from(atob(url.slice(comma + 1)), (char) =>
    char.charCodeAt(0),
  );
  return new Blob([bytes], { type: mime });
}
export async function importWardrobe(file: File) {
  if (file.size > 192 * 1024 * 1024)
    throw Error('이 기기에서는 192MB 이하의 옷장 백업을 열 수 있어요.');
  let json;
  try {
    json = JSON.parse(await file.text());
  } catch {
    invalid();
  }
  if (
    !json ||
    json.schemaVersion !== 1 ||
    !Array.isArray(json.garments) ||
    !Array.isArray(json.outfits) ||
    !Array.isArray(json.images)
  )
    invalid();
  if (
    json.garments.some(
      (row: Garment) =>
        !row || (row.photoUnavailable === true && !row.purchase),
    )
  )
    invalid();
  const garments: Garment[] = json.garments.map((row: Garment) => ({
    id: id(row?.id),
    ...garmentFields(row, row.color),
    ...(row.photoUnavailable === true ? { photoUnavailable: true } : {}),
    createdAt: date(row.createdAt),
    updatedAt: date(row.updatedAt),
  }));
  const unique = new Set(garments.map((g) => g.id));
  if (unique.size !== garments.length) invalid();
  const outfits: Outfit[] = json.outfits.map((row: Outfit) => {
    const members = outfitMembers(row?.garmentIds);
    if (members.some((member) => !unique.has(member))) invalid();
    return {
      id: id(row.id),
      name: itemName(row.name),
      garmentIds: members,
      createdAt: date(row.createdAt),
      updatedAt: date(row.updatedAt),
    };
  });
  if (new Set(outfits.map((o) => o.id)).size !== outfits.length) invalid();
  const images = new Map<string, PreparedImage>();
  for (const row of json.images) {
    const key = id(row?.garmentId);
    if (!unique.has(key) || images.has(key)) invalid();
    const prepared = await prepareImage(bytesFromUrl(row.original));
    if (prepared.hash !== row.hash) invalid();
    images.set(key, prepared);
  }
  if (garments.some((g) => images.has(g.id) === (g.photoUnavailable === true)))
    invalid();
  return mergeBackup(garments, outfits, images);
}
