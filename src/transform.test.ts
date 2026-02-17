import { describe, it, expect } from 'vitest'
import {
  amountToInteger,
  toActualTransaction,
  transformTransactions,
} from './transform.js'
import type { RedbarkTransaction } from './types.js'

describe('amountToInteger', () => {
  it('converts dollar amounts to integer cents', () => {
    expect(amountToInteger('12.50')).toBe(1250)
    expect(amountToInteger('0.99')).toBe(99)
    expect(amountToInteger('1000')).toBe(100000)
    expect(amountToInteger('0.01')).toBe(1)
    expect(amountToInteger('999.99')).toBe(99999)
  })

  it('handles zero', () => {
    expect(amountToInteger('0')).toBe(0)
    expect(amountToInteger('0.00')).toBe(0)
  })
})

describe('toActualTransaction', () => {
  const baseTxn: RedbarkTransaction = {
    id: 'txn-123',
    accountId: 'acc-456',
    accountName: 'Smart Access',
    status: 'posted',
    date: '2024-08-20',
    description: 'WOOLWORTHS 1234 SYDNEY',
    amount: '12.50',
    direction: 'debit',
    merchantName: 'Woolworths',
    category: 'groceries',
  }

  it('maps debit transactions as negative amounts', () => {
    const result = toActualTransaction(baseTxn)
    expect(result.amount).toBe(-1250)
  })

  it('maps credit transactions as positive amounts', () => {
    const result = toActualTransaction({ ...baseTxn, direction: 'credit' })
    expect(result.amount).toBe(1250)
  })

  it('uses merchantName as payee_name when available', () => {
    const result = toActualTransaction(baseTxn)
    expect(result.payee_name).toBe('Woolworths')
  })

  it('falls back to description when merchantName is missing', () => {
    const result = toActualTransaction({
      ...baseTxn,
      merchantName: undefined,
    })
    expect(result.payee_name).toBe('WOOLWORTHS 1234 SYDNEY')
  })

  it('sets imported_id with redbark prefix', () => {
    const result = toActualTransaction(baseTxn)
    expect(result.imported_id).toBe('redbark:txn-123')
  })

  it('preserves raw description as imported_payee', () => {
    const result = toActualTransaction(baseTxn)
    expect(result.imported_payee).toBe('WOOLWORTHS 1234 SYDNEY')
  })

  it('sets cleared to true for posted transactions', () => {
    const result = toActualTransaction(baseTxn)
    expect(result.cleared).toBe(true)
  })

  it('sets cleared to false for pending transactions', () => {
    const result = toActualTransaction({ ...baseTxn, status: 'pending' })
    expect(result.cleared).toBe(false)
  })

  it('includes category in notes', () => {
    const result = toActualTransaction(baseTxn)
    expect(result.notes).toBe('groceries')
  })

  it('omits notes when no category', () => {
    const result = toActualTransaction({
      ...baseTxn,
      category: undefined,
    })
    expect(result.notes).toBeUndefined()
  })
})

describe('transformTransactions', () => {
  it('filters out pending transactions', () => {
    const transactions: RedbarkTransaction[] = [
      {
        id: 'txn-1',
        accountId: 'acc-1',
        accountName: 'Account',
        status: 'posted',
        date: '2024-08-20',
        description: 'Posted txn',
        amount: '10.00',
        direction: 'debit',
      },
      {
        id: 'txn-2',
        accountId: 'acc-1',
        accountName: 'Account',
        status: 'pending',
        date: '2024-08-21',
        description: 'Pending txn',
        amount: '20.00',
        direction: 'debit',
      },
    ]

    const result = transformTransactions(transactions)
    expect(result).toHaveLength(1)
    expect(result[0]!.imported_id).toBe('redbark:txn-1')
  })

  it('returns empty array when all transactions are pending', () => {
    const transactions: RedbarkTransaction[] = [
      {
        id: 'txn-1',
        accountId: 'acc-1',
        accountName: 'Account',
        status: 'pending',
        date: '2024-08-20',
        description: 'Pending',
        amount: '10.00',
        direction: 'debit',
      },
    ]

    const result = transformTransactions(transactions)
    expect(result).toHaveLength(0)
  })
})
