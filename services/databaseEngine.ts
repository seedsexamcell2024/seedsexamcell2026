
const DB_NAME = 'SEEDS_V12';
const STORE = 'vault';

export class DatabaseEngine {
  private static instance: DatabaseEngine;
  private db: IDBDatabase | null = null;

  static getInstance() { return this.instance || (this.instance = new DatabaseEngine()); }

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e: any) => e.target.result.createObjectStore(STORE);
      req.onsuccess = (e: any) => { this.db = e.target.result; res(this.db!); };
      req.onerror = rej;
    });
  }

  async save(key: string, data: any): Promise<void> {
    const db = await this.init();
    const clean = JSON.parse(JSON.stringify(data || []));
    return new Promise((res, rej) => {
      const tx = db.transaction([STORE], 'readwrite');
      tx.objectStore(STORE).put(clean, key);
      tx.oncomplete = () => {
        if (key.includes('identity')) localStorage.setItem('LOGO_BK', JSON.stringify(clean));
        res();
      };
      tx.onerror = rej;
    });
  }

  async load<T>(key: string): Promise<T | null> {
    const db = await this.init();
    return new Promise((res) => {
      const tx = db.transaction([STORE], 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => res(req.result || (key.includes('identity') ? JSON.parse(localStorage.getItem('LOGO_BK') || 'null') : null));
      req.onerror = () => res(null);
    });
  }

  async purge(): Promise<void> {
    const db = await this.init();
    return new Promise((res) => {
      const tx = db.transaction([STORE], 'readwrite');
      tx.objectStore(STORE).clear();
      localStorage.clear();
      tx.oncomplete = () => { this.db = null; res(); };
    });
  }
}

export const SIDE = DatabaseEngine.getInstance();
