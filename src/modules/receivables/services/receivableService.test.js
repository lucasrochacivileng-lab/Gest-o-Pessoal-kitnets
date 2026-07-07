import { describe, expect, it } from 'vitest';
import {
  calculateOutstandingValue,
  calculatePaymentNetValue,
  getReceivableStatus,
  receivableService,
} from './receivableService.js';
import { RECEIVABLE_FILTERS, RECEIVABLE_STATUS } from '../types/receivable.types.js';

describe('receivableService', () => {
  it('marks pending receivables as overdue when due date has passed', () => {
    const status = getReceivableStatus(
      { status: RECEIVABLE_STATUS.PENDING, due_date: '2026-07-01' },
      '2026-07-07',
    );

    expect(status).toBe(RECEIVABLE_STATUS.OVERDUE);
  });

  it('calculates net payment with discounts, fines and interest', () => {
    expect(calculatePaymentNetValue({ paid_value: 800, discount: 50, fine: 20, interest: 10 })).toBe(780);
  });

  it('calculates outstanding value using the amount already paid', () => {
    expect(calculateOutstandingValue({ expected_value: 800, paid_value: 300 })).toBe(500);
    expect(calculateOutstandingValue({ expected_value: 800, paid_value: 900 })).toBe(0);
  });

  it('filters receivables by contextual search text', () => {
    const receivables = [
      {
        id: 'r1',
        status: RECEIVABLE_STATUS.PENDING,
        due_date: '2026-07-10',
        competence: '2026-07',
        kitnet: { id: 'k1', name: 'Kitnet 01' },
        tenant: { id: 't1', name: 'Maria Souza' },
      },
    ];

    const result = receivableService.filterReceivables(receivables, {
      statusFilter: RECEIVABLE_FILTERS.ALL,
      search: 'maria',
    });

    expect(result).toHaveLength(1);
  });
});
