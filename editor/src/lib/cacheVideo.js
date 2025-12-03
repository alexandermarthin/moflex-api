import { openDB } from "idb";

const DB_NAME = "video-cache";
const STORE_NAME = "videos";

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

const EXPIRATION_DAYS = 7;

export async function clearCache() {
  const db = await getDB();
  await db.clear(STORE_NAME);
  console.log("All cached videos cleared");
}

export async function cacheVideo(url) {
  const db = await getDB();
  const entry = await db.get(STORE_NAME, url);

  if (entry) {
    const { blob, timestamp } = entry;
    const age = (Date.now() - timestamp) / (1000 * 60 * 60 * 24); // Convert to days
    if (age < EXPIRATION_DAYS) {
      return URL.createObjectURL(blob);
    } else {
      await db.delete(STORE_NAME, url); // Remove expired entry
    }
  }

  const response = await fetch(url);
  const blob = await response.blob();
  await db.put(STORE_NAME, { blob, timestamp: Date.now() }, url);

  return URL.createObjectURL(blob);
}
