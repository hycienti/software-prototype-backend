import type { HttpContext } from '@adonisjs/core/http'
import TherapistWalletService from '#services/therapist_wallet_service'
import vine from '@vinejs/vine'
import { walletListValidator } from '#validators/list_validator'
import { successResponse, errorResponse, ErrorCodes } from '#utils/response_helper'

const withdrawValidator = vine.compile(
  vine.object({
    amountCents: vine.number().min(100), // min $1
  })
)

const DEFAULT_TRANSACTIONS_LIMIT = 20
const DEFAULT_WITHDRAWALS_LIMIT = 10

const therapistWalletService = new TherapistWalletService()

export default class TherapistWalletController {
  async index(ctx: HttpContext) {
    const therapist = ctx.auth.use('therapist').user!
    const qs = await walletListValidator.validate(ctx.request.qs())
    const transactionsPage = qs.transactionsPage ?? 1
    const transactionsLimit = qs.transactionsLimit ?? DEFAULT_TRANSACTIONS_LIMIT
    const withdrawalsPage = qs.withdrawalsPage ?? 1
    const withdrawalsLimit = qs.withdrawalsLimit ?? DEFAULT_WITHDRAWALS_LIMIT

    const result = await therapistWalletService.getWalletWithTransactionsAndWithdrawals(
      therapist.id,
      {
        transactionsPage,
        transactionsLimit,
        withdrawalsPage,
        withdrawalsLimit,
      }
    )

    return successResponse(ctx, {
      balanceCents: result.wallet.balanceCents,
      balance: (result.wallet.balanceCents / 100).toFixed(2),
      recentTransactions: result.transactions.map((t) => ({
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
        total: result.transactionsTotal,
      },
      recentWithdrawals: result.withdrawals.map((w) => ({
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
        total: result.withdrawalsTotal,
      },
    })
  }

  async withdraw(ctx: HttpContext) {
    const therapist = ctx.auth.use('therapist').user!
    const { amountCents } = await withdrawValidator.validate(ctx.request.all())

    const result = await therapistWalletService.withdraw(therapist.id, amountCents)

    if ('error' in result) {
      return errorResponse(
        ctx,
        ErrorCodes.BAD_REQUEST,
        'Insufficient balance',
        400,
        { balanceCents: result.balanceCents }
      )
    }

    return successResponse(
      ctx,
      {
        withdrawal: {
          id: result.withdrawal.id,
          amountCents: result.withdrawal.amountCents,
          amount: (result.withdrawal.amountCents / 100).toFixed(2),
          status: result.withdrawal.status,
          requestedAt: result.withdrawal.requestedAt.toISO(),
        },
        newBalanceCents: result.newBalanceCents,
        newBalance: (result.newBalanceCents / 100).toFixed(2),
      },
      201
    )
  }
}
