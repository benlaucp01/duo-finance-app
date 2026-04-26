import type { Expense, ExpenseSplit, Settlement } from '../types'
import { roundMoney } from './money'

export function expensesForMonth(expenses: Expense[], month: string) {
  return expenses
    .filter((expense) => expense.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function calculateSettlement(
  expenses: Expense[],
  settlementRatio?: ExpenseSplit,
): Settlement {
  const totalHkd = roundMoney(
    expenses.reduce((total, expense) => total + expense.hkdAmount, 0),
  )

  const paid = expenses.reduce(
    (totals, expense) => {
      totals[expense.payerId] = roundMoney(
        totals[expense.payerId] + expense.hkdAmount,
      )
      return totals
    },
    { personA: 0, personB: 0 },
  )

  const ratioTotal =
    settlementRatio && settlementRatio.personA + settlementRatio.personB > 0
      ? settlementRatio.personA + settlementRatio.personB
      : 0

  const owed =
    ratioTotal > 0
      ? {
          personA: roundMoney(totalHkd * (settlementRatio!.personA / ratioTotal)),
          personB: roundMoney(
            totalHkd - roundMoney(totalHkd * (settlementRatio!.personA / ratioTotal)),
          ),
        }
      : expenses.reduce(
          (totals, expense) => {
            totals.personA = roundMoney(totals.personA + expense.split.personA)
            totals.personB = roundMoney(totals.personB + expense.split.personB)
            return totals
          },
          { personA: 0, personB: 0 },
        )

  const net = {
    personA: roundMoney(paid.personA - owed.personA),
    personB: roundMoney(paid.personB - owed.personB),
  }

  const transfer =
    Math.abs(net.personA) < 0.01
      ? { from: null, to: null, amount: 0 }
      : net.personA > 0
        ? { from: 'personB' as const, to: 'personA' as const, amount: net.personA }
        : {
            from: 'personA' as const,
            to: 'personB' as const,
            amount: Math.abs(net.personA),
          }

  const byCategory = Object.values(
    expenses.reduce<Record<string, { categoryId: string; amount: number }>>(
      (groups, expense) => {
        const current = groups[expense.categoryId] ?? {
          categoryId: expense.categoryId,
          amount: 0,
        }
        current.amount = roundMoney(current.amount + expense.hkdAmount)
        groups[expense.categoryId] = current
        return groups
      },
      {},
    ),
  ).sort((a, b) => b.amount - a.amount)

  const byCurrency = Object.values(
    expenses.reduce<
      Record<string, { currency: Expense['originalCurrency']; originalAmount: number; hkdAmount: number }>
    >((groups, expense) => {
      const current = groups[expense.originalCurrency] ?? {
        currency: expense.originalCurrency,
        originalAmount: 0,
        hkdAmount: 0,
      }
      current.originalAmount = roundMoney(
        current.originalAmount + expense.originalAmount,
      )
      current.hkdAmount = roundMoney(current.hkdAmount + expense.hkdAmount)
      groups[expense.originalCurrency] = current
      return groups
    }, {}),
  ).sort((a, b) => b.hkdAmount - a.hkdAmount)

  return {
    totalHkd,
    paid,
    owed,
    net,
    transfer: { ...transfer, amount: roundMoney(transfer.amount) },
    byCategory,
    byCurrency,
  }
}

export function buildSplit(
  mode: Expense['splitMode'],
  hkdAmount: number,
  customPersonA: number,
) {
  if (mode === 'personA') {
    return { personA: hkdAmount, personB: 0 }
  }

  if (mode === 'personB') {
    return { personA: 0, personB: hkdAmount }
  }

  if (mode === 'custom') {
    const personA = Math.min(Math.max(customPersonA, 0), hkdAmount)
    return {
      personA: roundMoney(personA),
      personB: roundMoney(hkdAmount - personA),
    }
  }

  return {
    personA: roundMoney(hkdAmount / 2),
    personB: roundMoney(hkdAmount - roundMoney(hkdAmount / 2)),
  }
}
