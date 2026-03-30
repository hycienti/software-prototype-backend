import TherapistWallet from '#models/therapist_wallet'
import TherapistTransaction from '#models/therapist_transaction'
import TherapistWithdrawal from '#models/therapist_withdrawal'
import { DateTime } from 'luxon'

export default class TherapistWalletRepository {
  async findByTherapistId(therapistId: number): Promise<TherapistWallet | null> {
    return TherapistWallet.findBy('therapist_id', therapistId)
  }

  async createWallet(therapistId: number, balanceCents: number = 0): Promise<TherapistWallet> {
    return TherapistWallet.create({ therapistId, balanceCents })
  }

  async updateBalance(wallet: TherapistWallet, balanceCents: number): Promise<TherapistWallet> {
    wallet.balanceCents = balanceCents
    await wallet.save()
    return wallet
  }
}

export class TherapistTransactionRepository {
  async create(data: {
    therapistId: number
    amountCents: number
    type: string
    description: string | null
    sessionId: number | null
    withdrawalId: number | null
  }): Promise<TherapistTransaction> {
    return TherapistTransaction.create(data)
  }

  async listByTherapistIdPaginated(
    therapistId: number,
    page: number,
    limit: number
  ): Promise<{ data: TherapistTransaction[]; total: number }> {
    const base = TherapistTransaction.query().where('therapist_id', therapistId)
    const totalRow = await base.clone().count('* as total').first()
    const data = await base
      .orderBy('created_at', 'desc')
      .offset((page - 1) * limit)
      .limit(limit)
    return { data, total: Number(totalRow?.$extras?.total ?? 0) }
  }
}

export class TherapistWithdrawalRepository {
  async create(data: {
    therapistId: number
    amountCents: number
    status: string
    requestedAt: DateTime
  }): Promise<TherapistWithdrawal> {
    return TherapistWithdrawal.create(data)
  }

  async listByTherapistIdPaginated(
    therapistId: number,
    page: number,
    limit: number
  ): Promise<{ data: TherapistWithdrawal[]; total: number }> {
    const base = TherapistWithdrawal.query().where('therapist_id', therapistId)
    const totalRow = await base.clone().count('* as total').first()
    const data = await base
      .orderBy('requested_at', 'desc')
      .offset((page - 1) * limit)
      .limit(limit)
    return { data, total: Number(totalRow?.$extras?.total ?? 0) }
  }
}
