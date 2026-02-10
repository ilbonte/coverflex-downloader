/**
 * Tests for CSV conversion utilities
 */

import { operationsToCSV, generateFilename } from '../utils/csv.js';
import mockData from './fixtures/mock-operations.json';

describe('CSV Conversion', () => {
  describe('operationsToCSV', () => {
    test('should convert operations to CSV format with headers', () => {
      const csv = operationsToCSV(mockData);

      expect(csv).toBeTruthy();
      expect(csv).toContain('id,date,type,status,merchant,amount,currency');
      expect(csv.split('\n').length).toBeGreaterThan(1);
    });

    test('should include all operation types (expense, topup, refund)', () => {
      const csv = operationsToCSV(mockData);

      expect(csv).toContain('benefit_expense');
      expect(csv).toContain('topup');
      expect(csv).toContain('refund');
    });

    test('should include rejected transactions', () => {
      const csv = operationsToCSV(mockData);

      expect(csv).toContain('rejected');
      expect(csv).toContain('insufficient_funds');
    });

    test('should format amounts correctly (cents to euros)', () => {
      const csv = operationsToCSV(mockData);

      // 1200 cents = €12.00
      expect(csv).toContain('12.00');
      // 20000 cents = €200.00
      expect(csv).toContain('200.00');
    });

    test('should add negative sign for debit transactions', () => {
      const csv = operationsToCSV(mockData);
      const lines = csv.split('\n');

      // Find the gym expense line (debit)
      const debitLine = lines.find(line => line.includes('Example Gym Center'));
      expect(debitLine).toContain('-12.00');
    });

    test('should NOT add negative sign for credit transactions (topup)', () => {
      const csv = operationsToCSV(mockData);
      const lines = csv.split('\n');

      // Find the topup line (credit)
      const topupLine = lines.find(line => line.includes('topup'));
      expect(topupLine).toContain('200.00');
      expect(topupLine).not.toContain('-200.00');
    });

    test('should format dates as YYYY-MM-DD', () => {
      const csv = operationsToCSV(mockData);

      expect(csv).toContain('2025-12-21');
      expect(csv).toContain('2025-06-12');
    });

    test('should escape CSV special characters', () => {
      const dataWithSpecialChars = {
        operations: {
          list: [{
            id: "test-1",
            status: "confirmed",
            type: "benefit_expense",
            amount: { currency: "EUR", amount: 1000 },
            is_debit: true,
            executed_at: "2025-01-01T12:00:00Z",
            merchant_name: "Shop, With Comma",
            category_slug: "test",
            product_slug: "test"
          }]
        }
      };

      const csv = operationsToCSV(dataWithSpecialChars);
      expect(csv).toContain('"Shop, With Comma"');
    });

    test('should handle empty operations list', () => {
      const emptyData = { operations: { list: [] } };
      const csv = operationsToCSV(emptyData);

      expect(csv).toBe('');
    });

    test('should handle missing voucher data', () => {
      const dataWithoutVoucher = {
        operations: {
          list: [{
            id: "test-1",
            status: "confirmed",
            type: "topup",
            amount: { currency: "EUR", amount: 5000 },
            is_debit: false,
            executed_at: "2025-01-01T12:00:00Z"
          }]
        }
      };

      const csv = operationsToCSV(dataWithoutVoucher);
      expect(csv).toBeTruthy();
      expect(csv).toContain('50.00');
    });

    test('should process meal voucher transactions correctly', () => {
      const mealData = {
        operations: {
          list: [{
            id: "meal-1",
            status: "confirmed",
            type: "purchase",
            amount: { currency: "EUR", amount: 750 },
            is_debit: true,
            executed_at: "2026-01-28T12:58:40.518000Z",
            merchant_name: "RESTAURANT",
            category_slug: "meals",
            pocket: { type: "meals" }
          }]
        }
      };

      const csv = operationsToCSV(mealData);
      expect(csv).toContain('RESTAURANT');
      expect(csv).toContain('7.50');
      expect(csv).toContain('meals');
    });

    test('should fallback to budget name or description if merchant is missing', () => {
      const fallbackData = {
        operations: {
          list: [
            {
              id: "fallback-1",
              executed_at: "2026-01-01T12:00:00Z",
              merchant_name: null,
              budget_employee: { budget: { name: "Green Transportation" } },
              amount: { currency: "EUR", amount: 3000 },
              is_debit: true
            },
            {
              id: "fallback-2",
              executed_at: "2026-01-02T12:00:00Z",
              merchant_name: "unknown",
              description: "Backup Description",
              amount: { currency: "EUR", amount: 2000 },
              is_debit: true
            }
          ]
        }
      };

      const csv = operationsToCSV(fallbackData);
      expect(csv).toContain('Green Transportation');
      expect(csv).toContain('Backup Description');
    });
  });

  describe('generateFilename', () => {
    test('should generate filename with date range', () => {
      const from = '2025-01-01T00:00:00.000Z';
      const to = '2025-12-31T23:59:59.999Z';

      const filename = generateFilename(from, to);

      expect(filename).toContain('coverflex-transactions');
      expect(filename).toContain('2025-01-01');
      expect(filename).toContain('2025-12-31');
      expect(filename).toMatch(/\.csv$/);
    });

    test('should use only date portion of ISO strings', () => {
      const from = '2025-06-15T14:30:00.000Z';
      const to = '2025-06-20T18:45:00.000Z';

      const filename = generateFilename(from, to);

      expect(filename).toBe('coverflex-transactions_2025-06-15_2025-06-20.csv');
    });
  });
});
