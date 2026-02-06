import type { HttpContext } from '@adonisjs/core/http'
import TherapistWallet from '#models/therapist_wallet'
import TherapistTransaction from '#models/therapist_transaction'
import TherapistWithdrawal from '#models/therapist_withdrawal'
import vine from '@vinejs/vine'
import { walletListValidator } from '#validators/list_validator'

const withdrawValidator = vine.compile(
  vine.object({
    amountCents: vine.number().min(100), // min $1
  })
)

const DEFAULT_TRANSACTIONS_LIMIT = 20
const DEFAULT_WITHDRAWALS_LIMIT = 10

/**
 * Therapist wallet: balance, recent transactions, recent withdrawals.
 * Query: transactionsPage, transactionsLimit, withdrawalsPage, withdrawalsLimit.
 */
export default class TherapistWalletController {
  /**
   * @responseBody 200 - {"balanceCents": 10000, "balance": "100.00", "recentTransactions": [], "recentWithdrawals": [], "transactionsMeta": {"page": 1, "limit": 20, "total": 0}, "withdrawalsMeta": {"page": 1, "limit": 10, "total": 0}}
   */
  async index({ auth, request, response }: HttpContext) {
    const therapist = auth.use('therapist').user!
    const qs = await walletListValidator.validate(request.qs())
    const transactionsPage = qs.transactionsPage ?? 1
    const transactionsLimit = qs.transactionsLimit ?? DEFAULT_TRANSACTIONS_LIMIT
    const withdrawalsPage = qs.withdrawalsPage ?? 1
    const withdrawalsLimit = qs.withdrawalsLimit ?? DEFAULT_WITHDRAWALS_LIMIT

    let wallet = await TherapistWallet.findBy('therapist_id', therapist.id)
    if (!wallet) {
      wallet = await TherapistWallet.create({
        therapistId: therapist.id,
        balanceCents: 0,
      })
    }

    const transactionsQuery = TherapistTransaction.query()
      .where('therapist_id', therapist.id)
      .orderBy('created_at', 'desc')
    const transactionsTotal = await transactionsQuery.clone().count('* as total').first()
    const transactions = await transactionsQuery
      .offset((transactionsPage - 1) * transactionsLimit)
      .limit(transactionsLimit)

    const withdrawalsQuery = TherapistWithdrawal.query()
      .where('therapist_id', therapist.id)
      .orderBy('requested_at', 'desc')
    const withdrawalsTotal = await withdrawalsQuery.clone().count('* as total').first()
    const withdrawals = await withdrawalsQuery
      .offset((withdrawalsPage - 1) * withdrawalsLimit)
      .limit(withdrawalsLimit)

    return response.ok({
      balanceCents: wallet.balanceCents,
      balance: (wallet.balanceCents / 100).toFixed(2),
      recentTransactions: transactions.map((t) => ({
        id: t.id,
        amountCents: t.amountCents,
        amount: (t.amountCents / 100).toFixed(2),
        type: t.type,
        description: t.description,
        sessionId: t.sessionId,
        createdAt: t.createdAt.toISO(),
      })),
      transactionsMeta: {
        page: transactionsPage,
        limit: transactionsLimit,
        total: Number(transactionsTotal?.$extras?.total ?? 0),
      },
      recentWithdrawals: withdrawals.map((w) => ({
        id: w.id,
        amountCents: w.amountCents,
        amount: (w.amountCents / 100).toFixed(2),
        status: w.status,
        requestedAt: w.requestedAt.toISO(),
        completedAt: w.completedAt?.toISO() ?? null,
      })),
      withdrawalsMeta: {
        page: withdrawalsPage,
        limit: withdrawalsLimit,
        total: Number(withdrawalsTotal?.$extras?.total ?? 0),
      },
    })
  }

  /**
   * @responseBody 201 - {"withdrawal": {"id": 1, "amountCents": 5000, "amount": "50.00", "status": "pending", "requestedAt": "2026-01-20T10:00:00.000Z"}, "newBalanceCents": 5000, "newBalance": "50.00"}
   * @responseBody 400 - {"message": "Insufficient balance", "balanceCents": 0}
   */
  async withdraw({ auth, request, response }: HttpContext) {
    const therapist = auth.use('therapist').user!
    const { amountCents } = await withdrawValidator.validate(request.all())

    let wallet = await TherapistWallet.findBy('therapist_id', therapist.id)
    if (!wallet) {
      wallet = await TherapistWallet.create({
        therapistId: therapist.id,
        balanceCents: 0,
      })
    }

    if (wallet.balanceCents < amountCents) {
      return response.badRequest({
        message: 'Insufficient balance',
        balanceCents: wallet.balanceCents,
      })
    }

    const withdrawal = await TherapistWithdrawal.create({
      therapistId: therapist.id,
      amountCents,
      status: 'pending',
      requestedAt: new Date(),
    })

    wallet.balanceCents -= amountCents
    await wallet.save()

    await TherapistTransaction.create({
      therapistId: therapist.id,
      amountCents: -amountCents,
      type: 'withdrawal',
      description: `Withdrawal request #${withdrawal.id}`,
      sessionId: null,
      withdrawalId: withdrawal.id,
    })

    return response.created({
      withdrawal: {
        id: withdrawal.id,
        amountCents: withdrawal.amountCents,
        amount: (withdrawal.amountCents / 100).toFixed(2),
        status: withdrawal.status,
        requestedAt: withdrawal.requestedAt.toISO(),
      },
      newBalanceCents: wallet.balanceCents,
      newBalance: (wallet.balanceCents / 100).toFixed(2),
    })
  }
}
