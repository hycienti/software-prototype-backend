import { DateTime } from 'luxon'
import type TherapistWallet from '#models/therapist_wallet'
import TherapistWalletRepository, {
  TherapistTransactionRepository,
  TherapistWithdrawalRepository,
} from '#repositories/therapist_wallet_repository'

const walletRepo = new TherapistWalletRepository()
const transactionRepo = new TherapistTransactionRepository()
const withdrawalRepo = new TherapistWithdrawalRepository()

export default class TherapistWalletService {
  async getOrCreateWallet(therapistId: number): Promise<TherapistWallet> {
    let wallet = await walletRepo.findByTherapistId(therapistId)
    if (!wallet) {
      wallet = await walletRepo.createWallet(therapistId, 0)
    }
    return wallet
  }

  /**
   * Credit the therapist's wallet for a session payment (mock payment flow).
   * Creates a session_payment transaction and increases balance.
   */
  async creditFromSession(
    therapistId: number,
    amountCents: number,
    sessionId: number,
    description: string | null = null
  ): Promise<TherapistWallet> {
    const wallet = await this.getOrCreateWallet(therapistId)
    const newBalanceCents = wallet.balanceCents + amountCents
    await transactionRepo.create({
      therapistId,
      amountCents,
      type: 'session_payment',
      description: description ?? `Session #${sessionId} payment`,
      sessionId,
      withdrawalId: null,
    })
    await walletRepo.updateBalance(wallet, newBalanceCents)
    return wallet
  }

  async getWalletWithTransactionsAndWithdrawals(
    therapistId: number,
    options: {
      transactionsPage: number
      transactionsLimit: number
      withdrawalsPage: number
      withdrawalsLimit: number
    }
  ) {
    const wallet = await this.getOrCreateWallet(therapistId)
    const [transactionsResult, withdrawalsResult] = await Promise.all([
      transactionRepo.listByTherapistIdPaginated(
        therapistId,
        options.transactionsPage,
        options.transactionsLimit
      ),
      withdrawalRepo.listByTherapistIdPaginated(
        therapistId,
        options.withdrawalsPage,
        options.withdrawalsLimit
      ),
    ])
    return {
      wallet,
      transactions: transactionsResult.data,
      transactionsTotal: transactionsResult.total,
      withdrawals: withdrawalsResult.data,
      withdrawalsTotal: withdrawalsResult.total,
    }
  }

  async withdraw(
    therapistId: number,
    amountCents: number
  ): Promise<
    | { withdrawal: Awaited<ReturnType<TherapistWithdrawalRepository['create']>>; newBalanceCents: number }
    | { error: 'INSUFFICIENT_BALANCE'; balanceCents: number }
  > {
    const wallet = await this.getOrCreateWallet(therapistId)
    if (wallet.balanceCents < amountCents) {
      return { error: 'INSUFFICIENT_BALANCE', balanceCents: wallet.balanceCents }
    }

    const withdrawal = await withdrawalRepo.create({
      therapistId,
      amountCents,
      status: 'pending',
      requestedAt: DateTime.now(),
    })

    const newBalanceCents = wallet.balanceCents - amountCents
    await walletRepo.updateBalance(wallet, newBalanceCents)

    await transactionRepo.create({
      therapistId,
      amountCents: -amountCents,
      type: 'withdrawal',
      description: `Withdrawal request #${withdrawal.id}`,
      sessionId: null,
      withdrawalId: withdrawal.id,
    })

    return { withdrawal, newBalanceCents }
  }
}
