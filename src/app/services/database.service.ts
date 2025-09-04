import { Injectable, signal } from '@angular/core';
import Dexie, { Table } from 'dexie';

export interface Vehicle {
  id?: number;
  alias: string;
  placa: string;
}

export interface Transaction {
  id?: number;
  vehicleId: number;
  date: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
}

export interface Setting {
  key: string;
  value: any;
}

@Injectable({
  providedIn: 'root'
})
export class DatabaseService extends Dexie {
  vehicles!: Table<Vehicle, number>;
  transactions!: Table<Transaction, number>;
  settings!: Table<Setting, string>;

  constructor() {
    super('MotoAppDB');
    this.version(1).stores({
      vehicles: '++id, alias, placa',
      transactions: '++id, vehicleId, date, type',
      settings: 'key'
    });
    this.on('populate', () => {
      this.settings.add({ key: 'currencySymbol', value: '$' });
      this.settings.add({ key: 'notificationsEnabled', value: false });
    });
  }
}
