const DB_NAME = "walking-line";
const STORE = "photos";
const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.72;

const remembered = new Set<string>();

let opening: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      opening = null;
      reject(request.error ?? new Error("The picture store did not open."));
    };
  });
  return opening;
}

export async function savePhoto(id: string, blob: Blob): Promise<void> {
  remembered.add(id);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(blob, id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("The picture did not save."));
  });
}

export async function loadPhoto(id: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
    request.onsuccess = () => {
      const result = request.result;
      resolve(result instanceof Blob ? result : null);
    };
    request.onerror = () => reject(request.error ?? new Error("The picture could not be read."));
  });
}

export async function deletePhoto(id: string): Promise<void> {
  remembered.delete(id);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("The picture could not be removed."));
  });
}

export async function deletePhotosExcept(keep: Set<string>): Promise<void> {
  const db = await openDb();
  const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).getAllKeys();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The picture store could not be read."));
  });
  await Promise.all(
    keys
      .filter((key) => typeof key === "string" && !keep.has(key) && !remembered.has(key))
      .map((key) => deletePhoto(String(key))),
  );
}

export async function compressImage(file: File): Promise<Blob> {
  if (file.size > 25_000_000) throw new Error("too large");
  const bitmap = await createImageBitmap(file);
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest < 1) throw new Error("empty");
    const scale = Math.min(1, MAX_EDGE / longest);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/jpeg", JPEG_QUALITY);
    });
    if (!blob) throw new Error("encode");
    return blob;
  } finally {
    bitmap.close();
  }
}
