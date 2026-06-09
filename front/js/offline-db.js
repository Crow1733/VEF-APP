/**
 * VEF Offline DB — Wrapper de IndexedDB para modo sin conexión.
 * Stores: productos, categorias, kv (clave-valor), outbox (cola de escrituras)
 * Expone: window.vefDB
 */
(function () {
    const DB_NAME = 'vef-offline';
    const DB_VERSION = 1;

    class VefDB {
        constructor() { this._p = null; }

        open() {
            if (this._p) return this._p;
            this._p = new Promise((resolve, reject) => {
                const req = indexedDB.open(DB_NAME, DB_VERSION);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    [
                        ['productos',   { keyPath: 'id' }],
                        ['categorias',  { keyPath: 'id' }],
                        ['kv',          { keyPath: 'k'  }],
                    ].forEach(([name, opts]) => {
                        if (!db.objectStoreNames.contains(name))
                            db.createObjectStore(name, opts);
                    });
                    if (!db.objectStoreNames.contains('outbox')) {
                        const ob = db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
                        ob.createIndex('by_ts', 'ts');
                    }
                };
                req.onsuccess  = (e) => { this._db = e.target.result; resolve(this._db); };
                req.onerror    = ()  => reject(req.error);
            });
            return this._p;
        }

        // ── Helpers genéricos ──────────────────────────────────────────────
        async getAll(store) {
            const db = await this.open();
            return new Promise((res, rej) => {
                const r = db.transaction(store, 'readonly').objectStore(store).getAll();
                r.onsuccess = () => res(r.result);
                r.onerror   = () => rej(r.error);
            });
        }

        async get(store, key) {
            const db = await this.open();
            return new Promise((res, rej) => {
                const r = db.transaction(store, 'readonly').objectStore(store).get(key);
                r.onsuccess = () => res(r.result);
                r.onerror   = () => rej(r.error);
            });
        }

        async put(store, item) {
            const db = await this.open();
            return new Promise((res, rej) => {
                const r = db.transaction(store, 'readwrite').objectStore(store).put(item);
                r.onsuccess = () => res(r.result);
                r.onerror   = () => rej(r.error);
            });
        }

        async putAll(store, items) {
            if (!items || !items.length) return;
            const db = await this.open();
            return new Promise((res, rej) => {
                const tx = db.transaction(store, 'readwrite');
                const st = tx.objectStore(store);
                items.forEach(i => st.put(i));
                tx.oncomplete = () => res();
                tx.onerror    = () => rej(tx.error);
            });
        }

        async del(store, key) {
            const db = await this.open();
            return new Promise((res, rej) => {
                const r = db.transaction(store, 'readwrite').objectStore(store).delete(key);
                r.onsuccess = () => res();
                r.onerror   = () => rej(r.error);
            });
        }

        async count(store) {
            const db = await this.open();
            return new Promise((res, rej) => {
                const r = db.transaction(store, 'readonly').objectStore(store).count();
                r.onsuccess = () => res(r.result);
                r.onerror   = () => rej(r.error);
            });
        }

        // ── Key-Value ──────────────────────────────────────────────────────
        async kvGet(key)        { const r = await this.get('kv', key); return r ? r.v : undefined; }
        async kvSet(key, value) { return this.put('kv', { k: key, v: value }); }

        // ── Outbox (cola de operaciones pendientes) ────────────────────────
        async pushOutbox(op, payload) {
            return this.put('outbox', { op, payload, ts: Date.now(), retries: 0 });
        }
        async getAllOutbox()  { return this.getAll('outbox'); }
        async delOutbox(id)  { return this.del('outbox', id); }
        async countOutbox()  { return this.count('outbox'); }
    }

    window.vefDB = new VefDB();
})();
