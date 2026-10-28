import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const chunkSize = 1600;
const maxSessionLength = 128_000;
const options: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

function splitIntoChunks(value: string): string[] {
  const chunks: string[] = [];
  let chunk = '';
  for (const character of value) {
    if (chunk.length + character.length > chunkSize) {
      chunks.push(chunk);
      chunk = '';
    }
    chunk += character;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

function parseManifest(value: string | null): { version: string; count: number } | null {
  if (!value) return null;
  const [version, rawCount, extra] = value.split(':');
  const count = Number(rawCount);
  if (extra !== undefined || !version || !Number.isInteger(count) || count < 1 || count > 128) return null;
  return { version, count };
}

async function removeChunks(key: string, manifest: { version: string; count: number } | null) {
  if (!manifest) return;
  await Promise.all(Array.from({ length: manifest.count }, (_, index) =>
    SecureStore.deleteItemAsync(`${key}.${manifest.version}.${index}`),
  ));
}

/** Secure, chunked session storage with migration from the previous AsyncStorage key. */
export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const manifest = parseManifest(await SecureStore.getItemAsync(`${key}.manifest`));
    if (manifest) {
      const values = await Promise.all(Array.from({ length: manifest.count }, (_, index) =>
        SecureStore.getItemAsync(`${key}.${manifest.version}.${index}`),
      ));
      if (values.every((value): value is string => value !== null)) return values.join('');
    }

    const legacyValue = await AsyncStorage.getItem(key);
    if (!legacyValue) return null;
    try {
      await this.setItem(key, legacyValue);
      await AsyncStorage.removeItem(key);
    } catch {
      if (__DEV__) console.warn('Secure session migration could not finish.');
    }
    return legacyValue;
  },

  async setItem(key: string, value: string): Promise<void> {
    if (value.length > maxSessionLength) throw new Error('Session data exceeds the secure storage limit.');
    const priorManifest = parseManifest(await SecureStore.getItemAsync(`${key}.manifest`));
    const version = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const chunks = splitIntoChunks(value);
    if (!chunks.length) chunks.push('');
    for (const [index, chunk] of chunks.entries()) {
      await SecureStore.setItemAsync(`${key}.${version}.${index}`, chunk, options);
    }
    await SecureStore.setItemAsync(`${key}.manifest`, `${version}:${chunks.length}`, options);
    await removeChunks(key, priorManifest).catch(() => undefined);
  },

  async removeItem(key: string): Promise<void> {
    const manifest = parseManifest(await SecureStore.getItemAsync(`${key}.manifest`));
    await removeChunks(key, manifest);
    await SecureStore.deleteItemAsync(`${key}.manifest`);
    await AsyncStorage.removeItem(key);
  },
};
