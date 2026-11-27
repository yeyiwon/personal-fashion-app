import {
  garmentFields,
  itemName,
  outfitMembers,
  WardrobeError,
} from './domain';
import type { Garment, GarmentDraft, Outfit } from './domain';
import { MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS } from './images';
import type { PreparedImage } from './images';

const DB_NAME = 'personal-fashion-wardrobe';
const STORES = ['garments', 'images', 'outfits', 'profile'] as const;
type Store = (typeof STORES)[number];
interface ImageRecord extends PreparedImage {
  garmentId: string;
}
interface DeviceProfile {
  id: 'device';
  createdAt: string;
  storage: 'local';
}
let connection: Promise<IDBDatabase> | undefined;

function storageIssue(error: unknown): Error {
  if (error instanceof WardrobeError) return error;
  if (error instanceof DOMException && error.name === 'QuotaExceededError')
    return new WardrobeError(
      'QUOTA',
      '기기 저장 공간이 부족해요. 공간을 확보한 뒤 다시 시도해 주세요.',
    );
  return new WardrobeError(
    'STORAGE',
    '기기 저장소를 이용할 수 없어요. 브라우저의 저장 설정을 확인하고 다시 시도해 주세요.',
  );
}

function open(): Promise<IDBDatabase> {
  if (connection) return connection;
  if (!globalThis.indexedDB) return Promise.reject(storageIssue(undefined));
  const pending = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('garments', { keyPath: 'id' });
      db.createObjectStore('images', { keyPath: 'garmentId' }).createIndex(
        'hash',
        'hash',
        {
          unique: true,
        },
      );
      db.createObjectStore('outfits', { keyPath: 'id' }).createIndex(
        'member',
        'garmentIds',
        {
          multiEntry: true,
        },
      );
      db.createObjectStore('profile', { keyPath: 'id' });
    };
    request.onblocked = () => {
      blocked = true;
      reject(
        new WardrobeError('BLOCKED', '다른 탭의 옷장을 닫고 다시 열어 주세요.'),
      );
    };
    request.onerror = () => reject(storageIssue(request.error));
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) {
        db.close();
        return;
      }
      db.onversionchange = () => {
        db.close();
        if (connection === pending) connection = undefined;
      };
      db.onclose = () => {
        if (connection === pending) connection = undefined;
      };
      resolve(db);
    };
  });
  connection = pending;
  void pending.catch(() => {
    if (connection === pending) connection = undefined;
  });
  return pending;
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Only database requests may be awaited inside work(). Finish image processing outside this scope. */
async function transaction<T>(
  names: Store[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => Promise<T>,
): Promise<T> {
  const db = await open();
  let tx: IDBTransaction;
  try {
    tx = db.transaction(names, mode);
  } catch (error) {
    throw storageIssue(error);
  }
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('aborted'));
  });
  // A request may fail before work() returns. Attach a listener immediately.
  void done.catch(() => {});
  try {
    const value = await work(tx);
    await done;
    return value;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* Already settled. */
    }
    await done.catch(() => {});
    throw storageIssue(error);
  }
}

function newId() {
  // getRandomValues also works on local WebView origins that do not expose randomUUID.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 15) | 64;
  bytes[8] = (bytes[8]! & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
    '',
  );
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}
function byRecent(
  a: { updatedAt: string; id: string },
  b: { updatedAt: string; id: string },
): number {
  return b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
}
async function ensureDevice(tx: IDBTransaction, now: string) {
  const store = tx.objectStore('profile');
  if (!(await result(store.getKey('device')))) {
    const profile: DeviceProfile = {
      id: 'device',
      storage: 'local',
      createdAt: now,
    };
    await result(store.add(profile));
  }
}

export async function listGarments(): Promise<Garment[]> {
  const rows = await transaction<Garment[]>(['garments'], 'readonly', (tx) =>
    result(tx.objectStore('garments').getAll()),
  );
  return rows.sort(byRecent);
}

export async function listOutfits(): Promise<Outfit[]> {
  const rows = await transaction<Outfit[]>(['outfits'], 'readonly', (tx) =>
    result(tx.objectStore('outfits').getAll()),
  );
  return rows.sort(byRecent);
}

export async function getImage(
  id: string,
  kind: 'preview' | 'original' = 'preview',
): Promise<Blob | null> {
  return transaction(['images'], 'readonly', async (tx) => {
    const image: ImageRecord | undefined = await result(
      tx.objectStore('images').get(id),
    );
    return image?.[kind] ?? null;
  });
}

function validatePrepared(image: PreparedImage): void {
  if (
    !image ||
    !(image.original instanceof Blob) ||
    !(image.preview instanceof Blob) ||
    image.original.size < 1 ||
    image.original.size > MAX_IMAGE_BYTES ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(image.original.type) ||
    image.preview.size < 1 ||
    image.preview.size > MAX_IMAGE_BYTES ||
    image.preview.type !== 'image/jpeg' ||
    !/^[a-f0-9]{64}$/.test(image.hash) ||
    !/^#[a-f0-9]{6}$/i.test(image.color) ||
    !Number.isSafeInteger(image.width) ||
    !Number.isSafeInteger(image.height) ||
    image.width < 1 ||
    image.height < 1 ||
    image.width * image.height > MAX_IMAGE_PIXELS
  ) {
    throw new WardrobeError(
      'INVALID',
      '사진 처리가 완료되지 않았어요. 사진을 다시 선택해 주세요.',
    );
  }
}

async function preventOrderDuplicate(tx: IDBTransaction, draft: GarmentDraft) {
  if (!draft.purchase?.sourceKey) return;
  const rows = await result<Garment[]>(tx.objectStore('garments').getAll());
  const old = rows.find(
    (g) => g.purchase?.sourceKey === draft.purchase?.sourceKey,
  );
  if (old)
    throw new WardrobeError(
      'DUPLICATE',
      '이 주문서의 같은 상품이 이미 옷장에 있어요.',
      old.id,
    );
}

export async function addGarment(
  draft: GarmentDraft,
  image: PreparedImage,
): Promise<Garment> {
  validatePrepared(image);
  const fields = garmentFields(draft, image.color);
  return transaction(
    ['garments', 'images', 'profile'],
    'readwrite',
    async (tx) => {
      await preventOrderDuplicate(tx, draft);
      const store = tx.objectStore('images');
      const existing = await result(store.index('hash').getKey(image.hash));
      if (existing !== undefined)
        throw new WardrobeError(
          'DUPLICATE',
          '같은 사진으로 등록한 옷이 이미 있어요.',
          String(existing),
        );
      const now = new Date().toISOString(),
        id = newId();
      const garment: Garment = {
        id,
        ...fields,
        createdAt: now,
        updatedAt: now,
      };
      const record: ImageRecord = {
        garmentId: id,
        hash: image.hash,
        original: image.original,
        preview: image.preview,
        width: image.width,
        height: image.height,
        color: image.color,
      };
      await Promise.all([
        result(store.add(record)),
        result(tx.objectStore('garments').add(garment)),
        ensureDevice(tx, now),
      ]);
      return garment;
    },
  );
}

/** Link and manually confirmed order entries can be registered before a garment photo is available. */
export async function addPurchaseGarment(
  draft: GarmentDraft,
): Promise<Garment> {
  if (!draft.purchase)
    throw new WardrobeError('INVALID', '구매 정보를 입력해 주세요.');
  const fields = garmentFields(draft, '#a8aab0');
  return transaction(['garments', 'profile'], 'readwrite', async (tx) => {
    await preventOrderDuplicate(tx, draft);
    const now = new Date().toISOString();
    const garment: Garment = {
      id: newId(),
      ...fields,
      photoUnavailable: true,
      createdAt: now,
      updatedAt: now,
    };
    await Promise.all([
      result(tx.objectStore('garments').add(garment)),
      ensureDevice(tx, now),
    ]);
    return garment;
  });
}

export async function updateGarment(
  id: string,
  draft: GarmentDraft,
): Promise<Garment> {
  return transaction(['garments'], 'readwrite', async (tx) => {
    const store = tx.objectStore('garments');
    const old: Garment | undefined = await result(store.get(id));
    if (!old) throw new WardrobeError('NOT_FOUND', '이 의류가 옷장에 없어요.');
    const fields = garmentFields(
      {
        ...draft,
        condition: draft.condition ?? old.condition,
        price: draft.price === undefined ? old.price : draft.price,
      },
      old.color,
    );
    const updated: Garment = {
      ...old,
      ...fields,
      updatedAt: new Date().toISOString(),
    };
    await result(store.put(updated));
    return updated;
  });
}

export async function deleteGarment(id: string): Promise<void> {
  await transaction(
    ['garments', 'images', 'outfits'],
    'readwrite',
    async (tx) => {
      if (await result(tx.objectStore('outfits').index('member').count(id))) {
        throw new WardrobeError(
          'IN_USE',
          '저장한 코디에서 이 옷을 먼저 빼 주세요.',
        );
      }
      await Promise.all([
        result(tx.objectStore('garments').delete(id)),
        result(tx.objectStore('images').delete(id)),
      ]);
    },
  );
}

/** Existence check and outfit write are serialized with garment deletion, including other tabs. */
export async function saveOutfit(
  name: string,
  garmentIds: readonly string[],
  id?: string,
): Promise<Outfit> {
  const title = itemName(name),
    members = outfitMembers(garmentIds);
  return transaction(['garments', 'outfits'], 'readwrite', async (tx) => {
    const garments = tx.objectStore('garments'),
      outfits = tx.objectStore('outfits');
    const keys = await Promise.all(
      members.map((member) => result(garments.getKey(member))),
    );
    if (keys.some((key) => key === undefined))
      throw new WardrobeError(
        'NOT_FOUND',
        '선택한 옷 중 옷장에서 삭제된 항목이 있어요.',
      );
    const now = new Date().toISOString();
    const before: Outfit | undefined =
      id !== undefined ? await result(outfits.get(id)) : undefined;
    if (id !== undefined && !before)
      throw new WardrobeError('NOT_FOUND', '이 코디가 저장 목록에 없어요.');
    const outfit: Outfit = {
      id: before?.id ?? newId(),
      name: title,
      garmentIds: members,
      createdAt: before?.createdAt ?? now,
      updatedAt: now,
    };
    if (before) await result(outfits.put(outfit));
    else await result(outfits.add(outfit));
    return outfit;
  });
}

export async function deleteOutfit(id: string): Promise<void> {
  await transaction(['outfits'], 'readwrite', async (tx) => {
    await result(tx.objectStore('outfits').delete(id));
  });
}

async function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(
        new WardrobeError('STORAGE', '내보낼 이미지 파일을 읽을 수 없어요.'),
      );
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

/** Take one consistent DB snapshot before encoding blobs; never hold a write lock while serializing. */
export async function exportData(): Promise<Blob> {
  const [garments, outfits, images, profile] = await transaction(
    [...STORES],
    'readonly',
    (tx) =>
      Promise.all([
        result<Garment[]>(tx.objectStore('garments').getAll()),
        result<Outfit[]>(tx.objectStore('outfits').getAll()),
        result<ImageRecord[]>(tx.objectStore('images').getAll()),
        result<DeviceProfile | undefined>(
          tx.objectStore('profile').get('device'),
        ),
      ]),
  );
  const metadata = JSON.stringify({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    profile: profile ?? null,
    garments,
    outfits,
  });
  const parts: BlobPart[] = [metadata.slice(0, -1) + ',"images":['];
  for (const [i, image] of images.entries()) {
    const { original, preview, ...info } = image;
    const entry = JSON.stringify({
      ...info,
      original: await dataUrl(original),
      preview: await dataUrl(preview),
    });
    parts.push(new Blob([i ? ',' : '', entry]));
  }
  parts.push(']}');
  return new Blob(parts, { type: 'application/json' });
}

export async function clearData(): Promise<void> {
  await transaction([...STORES], 'readwrite', async (tx) => {
    await Promise.all(
      STORES.map((name) => result(tx.objectStore(name).clear())),
    );
  });
}

/** Merge validated, decoded images and outfits atomically. Existing edits always win. */
export async function mergeBackup(
  garments: Garment[],
  outfits: Outfit[],
  images: Map<string, PreparedImage>,
) {
  return transaction([...STORES], 'readwrite', async (tx) => {
    const garmentStore = tx.objectStore('garments'),
      imageStore = tx.objectStore('images');
    const outfitStore = tx.objectStore('outfits'),
      mapped = new Map<string, string>();
    let addedGarments = 0,
      addedOutfits = 0;
    for (const garment of garments) {
      if (garment.photoUnavailable === true) {
        mapped.set(garment.id, garment.id);
        if (!(await result(garmentStore.getKey(garment.id)))) {
          await result(garmentStore.add(garment));
          addedGarments++;
        }
        continue;
      }
      const image = images.get(garment.id)!;
      validatePrepared(image);
      const old = await result<ImageRecord | undefined>(
        imageStore.get(garment.id),
      );
      if (old && old.hash !== image.hash)
        throw new WardrobeError(
          'DUPLICATE',
          '같은 의류 ID의 사진이 서로 달라 복원을 취소했어요.',
        );
      const identical = await result(
        imageStore.index('hash').getKey(image.hash),
      );
      mapped.set(
        garment.id,
        identical !== undefined ? String(identical) : garment.id,
      );
      if (identical !== undefined) continue;
      await result(garmentStore.add(garment));
      await result(imageStore.add({ ...image, garmentId: garment.id }));
      addedGarments++;
    }
    for (const outfit of outfits) {
      if (await result(outfitStore.getKey(outfit.id))) continue;
      const members = Array.from(
        new Set(outfit.garmentIds.map((id) => mapped.get(id)!)),
      );
      await result(
        outfitStore.add({ ...outfit, garmentIds: outfitMembers(members) }),
      );
      addedOutfits++;
    }
    if (addedGarments || addedOutfits)
      await ensureDevice(tx, new Date().toISOString());
    return { addedGarments, addedOutfits };
  });
}
