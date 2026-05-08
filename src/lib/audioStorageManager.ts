/**
 * Gerenciador de armazenamento local para áudios gravados
 * Usa IndexedDB para armazenar áudio como backup
 * Permite recuperar áudios mesmo se o envio falhar
 */

interface StoredAudio {
  id: string;
  blob: Blob;
  duration: number;
  timestamp: Date;
  model: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

const DB_NAME = 'OmniNoteDB';
const STORE_NAME = 'audioRecordings';
const DB_VERSION = 1;

class AudioStorageManager {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private isClient = typeof window !== 'undefined';

  constructor() {
    if (this.isClient) {
      this.dbPromise = this.initDB();
    }
  }

  private async initDB(): Promise<IDBDatabase> {
    if (!this.isClient) {
      throw new Error('IndexedDB não está disponível no servidor');
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Erro ao abrir banco de dados:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
      };
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    if (!this.isClient) {
      throw new Error('IndexedDB não está disponível no servidor');
    }

    if (!this.dbPromise) {
      this.dbPromise = this.initDB();
    }

    return this.dbPromise;
  }

  /**
   * Salva um áudio gravado no IndexedDB
   */
  async saveAudio(blob: Blob, duration: number, model: string = 'soap'): Promise<string> {
    const db = await this.getDB();

    const audioId = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const audioRecord: StoredAudio = {
      id: audioId,
      blob,
      duration,
      timestamp: new Date(),
      model,
      status: 'pending',
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(audioRecord);

      request.onsuccess = () => {
        console.log('Áudio salvo localmente com ID:', audioId);
        resolve(audioId);
      };

      request.onerror = () => {
        console.error('Erro ao salvar áudio:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Recupera um áudio pelo ID
   */
  async getAudio(audioId: string): Promise<StoredAudio | null> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(audioId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Lista todos os áudios salvos
   */
  async getAllAudios(): Promise<StoredAudio[]> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const audios = (request.result as StoredAudio[]).sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        resolve(audios);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Atualiza status de um áudio
   */
  async updateAudioStatus(
    audioId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    error?: string
  ): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const getRequest = store.get(audioId);

      getRequest.onsuccess = () => {
        const audio = getRequest.result as StoredAudio;
        if (audio) {
          audio.status = status;
          if (error) {
            audio.error = error;
          }

          const updateRequest = store.put(audio);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Deleta um áudio
   */
  async deleteAudio(audioId: string): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(audioId);

      request.onsuccess = () => {
        console.log('Áudio deletado:', audioId);
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Deleta todos os áudios com status "completed"
   */
  async cleanupCompleted(): Promise<number> {
    await this.getDB();
    const audios = await this.getAllAudios();
    const completedCount = audios.filter((a) => a.status === 'completed').length;

    for (const audio of audios) {
      if (audio.status === 'completed') {
        await this.deleteAudio(audio.id);
      }
    }

    return completedCount;
  }

  /**
   * Obtém espaço livre aproximado do IndexedDB
   */
  async getStorageInfo(): Promise<{ used: number; quota: number }> {
    if (!this.isClient || !navigator.storage?.estimate) {
      return { used: 0, quota: 0 };
    }

    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage || 0,
      quota: estimate.quota || 0,
    };
  }

  /**
   * Download de um áudio como arquivo
   */
  async downloadAudio(audioId: string, filename: string): Promise<void> {
    const audio = await this.getAudio(audioId);

    if (!audio) {
      throw new Error('Áudio não encontrado');
    }

    const url = URL.createObjectURL(audio.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `consulta_${audio.timestamp.getTime()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// Instância única (será inicializada apenas no cliente)
export const audioStorageManager = new AudioStorageManager();

export type { StoredAudio };
