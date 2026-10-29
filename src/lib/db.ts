import Dexie, { Table } from 'dexie';

export interface SyncQueueItem {
  id?: number;
  action: string;
  payload: any;
  status: 'pending' | 'syncing' | 'failed';
  createdAt: string;
}

export interface FileQueueItem {
  id?: number;
  lrn: string;
  requirementName: string;
  fileBlob: Blob;
  fileName: string;
  status: 'pending' | 'syncing' | 'failed';
  createdAt: string;
}

export class AppDatabase extends Dexie {
  syncQueue!: Table<SyncQueueItem>;
  fileQueue!: Table<FileQueueItem>;

  constructor() {
    super('WorkImmersionDB');
    this.version(2).stores({
      syncQueue: '++id, action, status, createdAt',
      fileQueue: '++id, lrn, requirementName, status, createdAt'
    });
  }
}

export const db = new AppDatabase();
