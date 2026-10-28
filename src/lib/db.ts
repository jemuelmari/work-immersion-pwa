import Dexie, { Table } from 'dexie';

export interface SyncQueueItem {
  id?: number;
  action: string;
  payload: any;
  status: 'pending' | 'syncing' | 'failed';
  createdAt: string;
}

export class AppDatabase extends Dexie {
  syncQueue!: Table<SyncQueueItem>;

  constructor() {
    super('WorkImmersionDB');
    this.version(1).stores({
      syncQueue: '++id, action, status, createdAt'
    });
  }
}

export const db = new AppDatabase();
