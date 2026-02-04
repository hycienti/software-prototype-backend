import type { HttpContext } from '@adonisjs/core/http'
import TherapistWallet from '#models/therapist_wallet'
import TherapistTransaction from '#models/therapist_transaction'
import TherapistWithdrawal from '#models/therapist_withdrawal'
import vine from '@vinejs/vine'

const withdrawValidator = vine.compile(
  vine.object({
    amountCents: vine.number().min(100), // min $1
  })
)

/**
 * Therapist wallet: balance, recent transactions, request withdrawal.
 */
export default class TherapistWalletController {
  async index({ auth, response }: HttpContext) {
    const therapist = auth.use('therapist').user!

    let wallet = await TherapistWallet.findBy('therapist_id', therapist.id)
    if (!wallet) {
      wallet = await TherapistWallet.create({
        therapistId: therapist.id,
        balanceCents: 0,
      })
    }

    const transactions = await TherapistTransaction.query()
      .where('therapist_id', therapist.id)
      .orderBy('created_at', 'desc')
      .limit(20)

    const withdrawals = await TherapistWithdrawal.query()
      .where('therapist_id', therapist.id)
      .orderBy('requested_at', 'desc')
      .limit(10)

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
      recentWithdrawals: withdrawals.map((w) => ({
        id: w.id,
        amountCents: w.amountCents,
        amount: (w.amountCents / 100).toFixed(2),
        status: w.status,
        requestedAt: w.requestedAt.toISO(),
        completedAt: w.completedAt?.toISO() ?? null,
      })),
    })
  }

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
