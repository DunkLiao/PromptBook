const DB_NAME = 'PromptManagerDB';
const DB_VERSION = 2; // Upgraded to v2 for Folders
const STORE_NAME = 'prompts';
const FOLDER_STORE_NAME = 'folders';

const db = {
    _db: null,

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error("Database error:", event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this._db = event.target.result;
                resolve(this._db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;

                // Version 1 Setup
                if (oldVersion < 1) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('title', 'title', { unique: false });
                    store.createIndex('tags', 'tags', { unique: false });
                }

                // Version 2 & 3 Setup: Add Folders and new Prompt indices
                if (oldVersion < 3) {
                    if (!db.objectStoreNames.contains(FOLDER_STORE_NAME)) {
                        const folderStore = db.createObjectStore(FOLDER_STORE_NAME, { keyPath: 'id', autoIncrement: true });
                        folderStore.createIndex('parentId', 'parentId', { unique: false });
                    }
                    
                    // We can't easily add indexes to an existing store in some older browsers without recreating it, 
                    // but for modern browsers this is fine. For now, we will handle filtering in memory 
                    // since we load all prompts anyway.
                }
            };
        });
    },

    // --- Prompt Operations ---
    async getAllPrompts() {
        return new Promise((resolve, reject) => {
            if (!this._db) return reject("DB not initialized");
            const transaction = this._db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async addPrompt(prompt) {
        return new Promise((resolve, reject) => {
            if (!this._db) return reject("DB not initialized");
            const transaction = this._db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            const promptToAdd = {
                folderId: 'unassigned',
                isPinned: false,
                ...prompt,
                createdAt: new Date().getTime(),
                updatedAt: new Date().getTime()
            };
            
            const request = store.add(promptToAdd);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async updatePrompt(id, updatedData) {
        return new Promise((resolve, reject) => {
            if (!this._db) return reject("DB not initialized");
            const transaction = this._db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            const getRequest = store.get(id);
            
            getRequest.onsuccess = () => {
                const existingPrompt = getRequest.result;
                if (!existingPrompt) return reject(new Error("Prompt not found"));
                
                const promptToUpdate = {
                    ...existingPrompt,
                    ...updatedData,
                    id: id, 
                    updatedAt: new Date().getTime()
                };
                
                const putRequest = store.put(promptToUpdate);
                putRequest.onsuccess = () => resolve(putRequest.result);
                putRequest.onerror = () => reject(putRequest.error);
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    },

    async deletePrompt(id) {
        return new Promise((resolve, reject) => {
            if (!this._db) return reject("DB not initialized");
            const transaction = this._db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    // --- Folder Operations ---
    async getAllFolders() {
        return new Promise((resolve, reject) => {
            if (!this._db) return reject("DB not initialized");
            const transaction = this._db.transaction([FOLDER_STORE_NAME], 'readonly');
            const store = transaction.objectStore(FOLDER_STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async addFolder(folder) {
        return new Promise((resolve, reject) => {
            if (!this._db) return reject("DB not initialized");
            const transaction = this._db.transaction([FOLDER_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(FOLDER_STORE_NAME);
            
            const folderToAdd = {
                ...folder,
                createdAt: new Date().getTime()
            };
            
            const request = store.add(folderToAdd);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async updateFolder(id, updatedData) {
         return new Promise((resolve, reject) => {
            if (!this._db) return reject("DB not initialized");
            const transaction = this._db.transaction([FOLDER_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(FOLDER_STORE_NAME);
            
            const getRequest = store.get(id);
            
            getRequest.onsuccess = () => {
                const existingFolder = getRequest.result;
                if (!existingFolder) return reject(new Error("Folder not found"));
                
                const folderToUpdate = {
                    ...existingFolder,
                    ...updatedData,
                    id: id 
                };
                
                const putRequest = store.put(folderToUpdate);
                putRequest.onsuccess = () => resolve(putRequest.result);
                putRequest.onerror = () => reject(putRequest.error);
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    },

    async deleteFolder(id) {
        return new Promise((resolve, reject) => {
            if (!this._db) return reject("DB not initialized");
            const transaction = this._db.transaction([FOLDER_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(FOLDER_STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
};

window.db = db;