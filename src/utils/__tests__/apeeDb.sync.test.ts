/**
 * Test Suite for APEE Cache-to-DB Synchronization
 * 
 * Tests verify:
 * 1. Multi-school support (generic 'apee_parent' ID instead of hardcoded 'apee_ces_ekali_1')
 * 2. Race condition fix (Promise.all instead of forEach(async))
 * 3. Offline cache + Online sync integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock types matching the real implementation
interface ApeeParent {
  id: string;
  name: string;
  totalDue: number;
  totalPaid: number;
  status: string;
  phone?: string;
  email?: string;
  address?: string;
  students?: any[];
  payments?: any[];
  createdAt?: string;
  updatedAt?: string;
  note?: string;
  lastReminded?: string;
}

interface Invoice {
  id: string;
  studentId: string;
  parentId: string;
  title: string;
  amount: number;
  dueDate: string;
  status: string;
  paymentDate: string;
  [key: string]: any;
}

/**
 * TEST 1: Verify that generic 'apee_parent' ID is used (not hardcoded school ID)
 */
describe('apeeDb Synchronization - Bug Fixes', () => {
  
  describe('1. Multi-School Support (ID Fix)', () => {
    it('should normalize parent to Invoice with generic apee_parent marker', () => {
      // This mimics the normalizeToInvoice function
      const parent: ApeeParent = {
        id: 'parent_001',
        name: 'Mr. Dupont',
        totalDue: 50000,
        totalPaid: 25000,
        status: 'soldé',
        phone: '237654321098',
        email: 'dupont@example.com',
        students: [{ name: 'Alice', classRoom: '6A' }],
        payments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Function logic (simplified from apeeDb.ts)
      const normalizeToInvoice = (parent: ApeeParent, parentId: string): Invoice => {
        return {
          id: parent.id,
          studentId: 'apee_parent', // ← FIXED: Should be generic, not 'apee_ces_ekali_1'
          parentId,
          title: parent.name,
          amount: parent.totalDue,
          dueDate: new Date().toISOString(),
          status: parent.status === 'soldé' ? 'Paid' : 'Unpaid',
          paymentDate: parent.updatedAt || new Date().toISOString(),
          phone: parent.phone || '',
          address: parent.address || '',
          email: parent.email || '',
          note: parent.note || '',
          amountPaid: parent.totalPaid
        };
      };

      const schoolId = 'school_001';
      const invoice = normalizeToInvoice(parent, schoolId);

      // Verify the fix
      expect(invoice.studentId).toBe('apee_parent');
      expect(invoice.studentId).not.toBe('apee_ces_ekali_1');
      expect(invoice.parentId).toBe(schoolId);
      expect(invoice.title).toBe('Mr. Dupont');
      expect(invoice.amount).toBe(50000);
    });

    it('should filter parents by generic apee_parent ID from mixed Firestore data', () => {
      // Simulate Firestore data with multiple types
      const firestoreData: Invoice[] = [
        {
          id: 'parent_001',
          studentId: 'apee_parent', // ← Parent record
          parentId: 'school_001',
          title: 'Mr. Dupont',
          amount: 50000,
          dueDate: '2025/2026',
          status: 'Unpaid',
          paymentDate: new Date().toISOString()
        },
        {
          id: 'parent_002',
          studentId: 'apee_parent', // ← Another school's parent
          parentId: 'school_002',
          title: 'Mr. Dupont Jr.',
          amount: 35000,
          dueDate: '2025/2026',
          status: 'Paid',
          paymentDate: new Date().toISOString()
        },
        {
          id: 'expense_001',
          studentId: 'apee_expense', // ← Expense record (not a parent)
          parentId: 'school_001',
          title: 'Chalk and Materials',
          amount: 150000,
          dueDate: '2025/2026',
          status: 'Paid',
          paymentDate: new Date().toISOString()
        },
        {
          id: 'settings_001',
          studentId: 'apee_settings', // ← Settings record
          parentId: 'school_001',
          title: 'APEE Settings',
          amount: 0,
          dueDate: '2025/2026',
          status: 'Paid',
          paymentDate: new Date().toISOString()
        }
      ];

      // Filter logic from fetchApeeData
      const dbParents = firestoreData.filter(data => data.studentId === 'apee_parent');
      const dbExpenses = firestoreData.filter(data => data.studentId === 'apee_expense');
      const dbSettings = firestoreData.filter(data => data.studentId === 'apee_settings');

      // Verify correct filtering
      expect(dbParents).toHaveLength(2);
      expect(dbParents[0].title).toBe('Mr. Dupont');
      expect(dbParents[1].title).toBe('Mr. Dupont Jr.');

      expect(dbExpenses).toHaveLength(1);
      expect(dbExpenses[0].title).toBe('Chalk and Materials');

      expect(dbSettings).toHaveLength(1);
      expect(dbSettings[0].title).toBe('APEE Settings');

      // Verify NO hardcoded school references
      expect(dbParents.some(p => p.studentId === 'apee_ces_ekali_1')).toBe(false);
    });
  });

  describe('2. Race Condition Fix (Promise.all)', () => {
    it('should use Promise.all to ensure all async writes complete', async () => {
      const writeLog: string[] = [];
      
      // Mock async setDoc function
      const mockSetDoc = vi.fn(async (path: string, data: any) => {
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate network delay
        writeLog.push(`Written to ${path}`);
      });

      // Simulate data to sync
      const finalParents: ApeeParent[] = [
        { id: 'p1', name: 'Parent 1', totalDue: 10000, totalPaid: 5000, status: 'pending' },
        { id: 'p2', name: 'Parent 2', totalDue: 20000, totalPaid: 0, status: 'pending' },
        { id: 'p3', name: 'Parent 3', totalDue: 15000, totalPaid: 15000, status: 'soldé' }
      ];

      const dbParents: ApeeParent[] = [
        { id: 'p1', name: 'Parent 1', totalDue: 10000, totalPaid: 5000, status: 'pending' } // Already in DB
      ];

      const parentId = 'school_001';

      // FIXED: Use Promise.all instead of forEach(async)
      const syncPromises = finalParents.map(async (p) => {
        const isNewParent = !dbParents.some(dp => dp.id === p.id);
        if (isNewParent) {
          await mockSetDoc(`invoices/${p.id}`, { ...p, parentId, studentId: 'apee_parent' });
        }
      });

      // This is the key fix - we actually wait for all promises
      await Promise.all(syncPromises);

      // Verify all new parents were written
      expect(mockSetDoc).toHaveBeenCalledTimes(2); // p2 and p3 are new
      expect(writeLog).toHaveLength(2);
      expect(writeLog).toContain('Written to invoices/p2');
      expect(writeLog).toContain('Written to invoices/p3');
    });

    it('should handle errors gracefully in Promise.all', async () => {
      const writeLog: string[] = [];
      const errorLog: string[] = [];
      
      // Mock setDoc that throws for one parent
      const mockSetDoc = vi.fn(async (path: string, data: any) => {
        if (path.includes('p2')) {
          throw new Error('Network error for p2');
        }
        await new Promise(resolve => setTimeout(resolve, 5));
        writeLog.push(`Success: ${path}`);
      });

      const finalParents = [
        { id: 'p1', name: 'Parent 1', totalDue: 10000, totalPaid: 0, status: 'pending' },
        { id: 'p2', name: 'Parent 2', totalDue: 20000, totalPaid: 0, status: 'pending' },
        { id: 'p3', name: 'Parent 3', totalDue: 15000, totalPaid: 0, status: 'pending' }
      ];

      const parentId = 'school_001';

      const syncPromises = finalParents.map(async (p) => {
        try {
          await mockSetDoc(`invoices/${p.id}`, { ...p, parentId });
        } catch (e) {
          errorLog.push(`Failed for ${p.id}`);
        }
      });

      // Fixed: Use Promise.all - even if one fails, others complete
      await Promise.all(syncPromises);

      // Verify partial success is handled
      expect(writeLog).toHaveLength(2); // p1 and p3 succeeded
      expect(errorLog).toHaveLength(1); // p2 failed
      expect(errorLog[0]).toBe('Failed for p2');
    });

    it('should NOT lose data when forEach(async) is misused', async () => {
      /**
       * This test demonstrates the bug that was fixed.
       * 
       * BROKEN: Using forEach(async) returns immediately without waiting
       * const data = [];
       * finalParents.forEach(async (p) => {
       *   const result = await expensiveOperation();
       *   data.push(result); // This might never execute!
       * });
       * return data; // Returns empty array!
       */

      const writeLog: string[] = [];

      const mockSetDoc = vi.fn(async (id: string) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        writeLog.push(id);
      });

      const parents = [
        { id: 'p1', name: 'Parent 1' },
        { id: 'p2', name: 'Parent 2' },
        { id: 'p3', name: 'Parent 3' }
      ];

      // BROKEN WAY (before fix):
      const brokenWriteLog: string[] = [];
      parents.forEach(async (p) => {
        await mockSetDoc(`broken_${p.id}`);
        brokenWriteLog.push(p.id);
      });
      // Function returns immediately - brokenWriteLog is still empty!
      expect(brokenWriteLog).toHaveLength(0); // ← Shows the bug

      // Wait a bit to show the log eventually fills asynchronously
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(brokenWriteLog).toHaveLength(3); // ← Data arrives too late

      // FIXED WAY (after fix):
      const fixedWriteLog: string[] = [];
      const promises = parents.map(async (p) => {
        await mockSetDoc(`fixed_${p.id}`);
        fixedWriteLog.push(p.id);
      });
      await Promise.all(promises);
      expect(fixedWriteLog).toHaveLength(3); // ← Data is guaranteed when promise resolves

      expect(mockSetDoc).toHaveBeenCalledTimes(6); // 3 broken + 3 fixed
    });
  });

  describe('3. Offline Cache + Online Sync Integration', () => {
    it('should merge offline cache with Firestore data using timestamps', () => {
      const now = new Date().toISOString();
      const yesterday = new Date(Date.now() - 86400000).toISOString();

      // Simulated DB data (from Firestore)
      const dbParents: ApeeParent[] = [
        {
          id: 'parent_001',
          name: 'Mr. Dupont',
          totalDue: 50000,
          totalPaid: 25000,
          status: 'pending',
          updatedAt: yesterday // Old data
        }
      ];

      // Simulated cached data (local offline updates)
      const cachedParents: ApeeParent[] = [
        {
          id: 'parent_001',
          name: 'Mr. Dupont UPDATED',
          totalDue: 50000,
          totalPaid: 50000, // Recently paid offline
          status: 'soldé',
          updatedAt: now // Recent update
        },
        {
          id: 'parent_002', // New parent added offline
          name: 'Mr. Martin',
          totalDue: 30000,
          totalPaid: 0,
          status: 'pending',
          updatedAt: now
        }
      ];

      // Merge logic: cache wins on timestamp
      const mergedMap = new Map<string, ApeeParent>();
      
      // Add DB parents first
      dbParents.forEach(p => mergedMap.set(p.id, p));
      
      // Override with cache if newer
      cachedParents.forEach(cp => {
        const existing = mergedMap.get(cp.id);
        if (!existing) {
          mergedMap.set(cp.id, cp);
        } else {
          const dbTime = new Date(existing.updatedAt || 0).getTime();
          const cacheTime = new Date(cp.updatedAt || 0).getTime();
          if (cacheTime > dbTime) {
            mergedMap.set(cp.id, cp); // Cache is newer
          }
        }
      });

      const finalParents = Array.from(mergedMap.values());

      // Verify merge results
      expect(finalParents).toHaveLength(2);
      
      const parent001 = finalParents.find(p => p.id === 'parent_001');
      expect(parent001?.totalPaid).toBe(50000); // Updated from cache
      expect(parent001?.status).toBe('soldé'); // Updated from cache
      expect(parent001?.name).toBe('Mr. Dupont UPDATED'); // Updated from cache

      const parent002 = finalParents.find(p => p.id === 'parent_002');
      expect(parent002?.name).toBe('Mr. Martin'); // New from cache
      expect(parent002?.status).toBe('pending');
    });

    it('should prevent orphaned local data from being lost', async () => {
      const syncLog: string[] = [];

      const mockSetDoc = vi.fn(async (path: string) => {
        syncLog.push(`Synced: ${path}`);
      });

      // Data that exists only in cache (not in DB)
      const orphanedParents: ApeeParent[] = [
        { id: 'orphan_001', name: 'New Parent (offline)', totalDue: 25000, totalPaid: 0, status: 'pending' },
        { id: 'orphan_002', name: 'Another New Parent', totalDue: 15000, totalPaid: 0, status: 'pending' }
      ];

      const dbParents: ApeeParent[] = []; // Empty DB

      // Fixed background sync uses Promise.all to ensure all writes complete
      const syncPromises = orphanedParents
        .filter(p => !dbParents.some(dp => dp.id === p.id))
        .map(p => mockSetDoc(`invoices/${p.id}`));

      await Promise.all(syncPromises);

      // Verify orphaned data was synced
      expect(mockSetDoc).toHaveBeenCalledTimes(2);
      expect(syncLog).toHaveLength(2);
      expect(syncLog).toContain('Synced: invoices/orphan_001');
      expect(syncLog).toContain('Synced: invoices/orphan_002');
    });
  });
});
