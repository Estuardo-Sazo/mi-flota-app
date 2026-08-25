import { Injectable, effect, inject, signal } from '@angular/core';
import { Firestore, addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc } from '@angular/fire/firestore';
import { Timestamp, serverTimestamp } from 'firebase/firestore';
import { AuthService } from './auth.service';
import { SyncStatusService } from './sync-status.service';
import { transactionsPath } from './firestore-paths';

export interface Transaction {
  id: string;
  vehicleId: string;
  date: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  createdAt?: Timestamp;
}

export type NewTransaction = Omit<Transaction, 'id' | 'createdAt'>;

@Injectable({ providedIn: 'root' })
export class TransactionService {
  private firestore = inject(Firestore);
  private auth = inject(AuthService);
  private syncStatus = inject(SyncStatusService);

  private _transactions = signal<Transaction[]>([]);
  readonly transactions = this._transactions.asReadonly();

  constructor() {
    effect((onCleanup) => {
      const uid = this.auth.uid();
      if (!uid) {
        this._transactions.set([]);
        return;
      }
      const col = collection(this.firestore, transactionsPath(uid));
      const unsubscribe = onSnapshot(col, { includeMetadataChanges: true }, (snap) => {
        this._transactions.set(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction));
        this.syncStatus.reportSourceMetadata('transactions', {
          fromCache: snap.metadata.fromCache,
          hasPendingWrites: snap.metadata.hasPendingWrites
        });
      });
      onCleanup(() => unsubscribe());
    });
  }

  add(data: NewTransaction) {
    const uid = this.requireUid();
    return addDoc(collection(this.firestore, transactionsPath(uid)), {
      ...data,
      createdAt: serverTimestamp()
    });
  }

  update(id: string, data: Partial<NewTransaction>) {
    const uid = this.requireUid();
    return updateDoc(doc(this.firestore, `${transactionsPath(uid)}/${id}`), { ...data });
  }

  remove(id: string) {
    const uid = this.requireUid();
    return deleteDoc(doc(this.firestore, `${transactionsPath(uid)}/${id}`));
  }

  private requireUid(): string {
    const uid = this.auth.uid();
    if (!uid) throw new Error('No hay usuario autenticado');
    return uid;
  }
}
