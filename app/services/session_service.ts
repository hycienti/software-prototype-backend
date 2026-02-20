import { DateTime } from 'luxon'
import type Session from '#models/session'
import { SessionStatus } from '#enums/session'
import SessionRepository from '#repositories/session_repository'
import TherapistRepository from '#repositories/therapist_repository'
import { findMatchingSlot } from '#services/availability_service'
import TherapistWalletRepository from '#repositories/therapist_wallet_repository'

const sessionRepository = new SessionRepository()
const therapistRepository = new TherapistRepository()
const therapistWalletRepository = new TherapistWalletRepository()

export default class SessionService {
  async findById(id: number): Promise<Session | null> {
    return sessionRepository.findByIdWithRelations(id)
  }

  async findByIdAndTherapistId(id: number, therapistId: number): Promise<Session | null> {
    return sessionRepository.findByIdAndTherapistId(id, therapistId)
  }

  async findByIdAndUserId(id: number, userId: number): Promise<Session | null> {
    return sessionRepository.findByIdAndUserId(id, userId)
  }

  async listForTherapist(
    therapistId: number,
    options: { page: number; limit: number; status?: string }
  ): Promise<{ data: Session[]; total: number }> {
    return sessionRepository.listByTherapistId(therapistId, options)
  }

  async listForUser(
    userId: number,
    options: { page: number; limit: number; status?: string }
  ): Promise<{ data: Session[]; total: number }> {
    return sessionRepository.listByUserId(userId, options)
  }

  async create(data: {
    userId: number
    therapistId: number
    scheduledAt: DateTime
    durationMinutes: number
  }): Promise<
    { session: Session } | { error: 'THERAPIST_NOT_FOUND' | 'NO_SLOT' | 'SLOT_ALREADY_BOOKED' }
  > {
    const therapist = await therapistRepository.findById(data.therapistId)
    if (!therapist) return { error: 'THERAPIST_NOT_FOUND' }

    const slot = await findMatchingSlot(
      data.therapistId,
      data.scheduledAt,
      data.durationMinutes
    )
    if (!slot) return { error: 'NO_SLOT' }

    const overlapping = await sessionRepository.findOverlappingSession(
      data.therapistId,
      data.scheduledAt,
      data.durationMinutes
    )
    if (overlapping) return { error: 'SLOT_ALREADY_BOOKED' }

    const session = await sessionRepository.create({
      userId: data.userId,
      therapistId: data.therapistId,
      availabilitySlotId: slot.id,
      scheduledAt: data.scheduledAt,
      durationMinutes: data.durationMinutes,
      status: SessionStatus.SCHEDULED,
    })
    return { session }
  }

  async updateMeetingId(session: Session, meetingId: string): Promise<Session> {
    return sessionRepository.update(session, { meetingId })
  }

  async cancel(session: Session): Promise<Session> {
    return sessionRepository.update(session, { status: SessionStatus.CANCELLED })
  }

  async submitSummary(
    session: Session,
    payload: {
      sentiment: string
      engagementLevel?: number | null
      clinicalNotes?: string | null
      followUpAt?: string | null
      userSummaryMainTopics?: string[] | null
      userSummaryActionItems?: string[] | null
      userSummaryKeyReflection?: string | null
    }
  ): Promise<Session> {
    return sessionRepository.update(session, {
      sentiment: payload.sentiment as any,
      engagementLevel: payload.engagementLevel ?? null,
      clinicalNotes: payload.clinicalNotes ?? null,
      followUpAt: payload.followUpAt ? DateTime.fromISO(payload.followUpAt) : null,
      summaryCompletedAt: DateTime.now(),
      status: SessionStatus.COMPLETED,
      userSummaryMainTopics: payload.userSummaryMainTopics ?? null,
      userSummaryActionItems: payload.userSummaryActionItems ?? null,
      userSummaryKeyReflection: payload.userSummaryKeyReflection ?? null,
    })
  }

  async getDashboardStats(therapistId: number): Promise<{
    sessionsToday: number
    newRequests: number
    monthlyRevenueCents: number
    balanceCents: number
  }> {
    const todayStart = DateTime.now().startOf('day')
    const todayEnd = DateTime.now().endOf('day')
    const monthStart = DateTime.now().startOf('month')
    const monthEnd = DateTime.now().endOf('month')

    const [sessionsToday, newRequests, monthlyCompleted, wallet] = await Promise.all([
      sessionRepository.countByTherapistIdAndFilters(therapistId, {
        dateFrom: todayStart,
        dateTo: todayEnd,
        statusIn: [SessionStatus.SCHEDULED, SessionStatus.COMPLETED],
      }),
      sessionRepository.countByTherapistIdAndFilters(therapistId, {
        dateFrom: todayStart,
        status: SessionStatus.SCHEDULED,
      }),
      sessionRepository.countByTherapistIdAndFilters(therapistId, {
        dateFrom: monthStart,
        dateTo: monthEnd,
        status: SessionStatus.COMPLETED,
      }),
      therapistWalletRepository.findByTherapistId(therapistId),
    ])

    const monthlyRevenueCents = monthlyCompleted * 10000
    const balanceCents = wallet?.balanceCents ?? 0
    return { sessionsToday, newRequests, monthlyRevenueCents, balanceCents }
  }

  async getClientsForTherapist(
    therapistId: number,
    options: { page: number; limit: number; search?: string }
  ): Promise<{
    clients: Array<{
      userId: number
      fullName: string | null
      email: string
      avatarUrl: string | null
      lastSessionAt: string | null
      nextSessionAt: string | null
      sessionCount: number
    }>
    total: number
  }> {
    const sessions = await sessionRepository.listByTherapistIdWithUser(therapistId)
    const byUserId = new Map<
      number,
      {
        user: NonNullable<Session['user']>
        lastSessionAt: DateTime
        nextSessionAt: DateTime | null
        sessionCount: number
      }
    >()

    for (const s of sessions) {
      const uid = s.userId
      if (uid === null || !s.user) continue
      const existing = byUserId.get(uid)
      if (!existing) {
        const next = await sessionRepository.findNextScheduledForTherapistAndUser(
          therapistId,
          uid
        )
        byUserId.set(uid, {
          user: s.user,
          lastSessionAt: s.scheduledAt,
          nextSessionAt: next?.scheduledAt ?? null,
          sessionCount: 1,
        })
      } else {
        existing.sessionCount += 1
        if (s.scheduledAt > existing.lastSessionAt) {
          existing.lastSessionAt = s.scheduledAt
        }
      }
    }

    let clients = Array.from(byUserId.entries()).map(([userId, data]) => ({
      userId,
      fullName: data.user.fullName,
      email: data.user.email,
      avatarUrl: data.user.avatarUrl,
      lastSessionAt: data.lastSessionAt.toISO(),
      nextSessionAt: data.nextSessionAt?.toISO() ?? null,
      sessionCount: data.sessionCount,
    }))

    if (options.search?.trim()) {
      const term = options.search.trim().toLowerCase()
      clients = clients.filter(
        (c) =>
          (c.fullName ?? '').toLowerCase().includes(term) ||
          c.email.toLowerCase().includes(term)
      )
    }

    const total = clients.length
    const offset = (options.page - 1) * options.limit
    const paginatedClients = clients.slice(offset, offset + options.limit)
    return { clients: paginatedClients, total }
  }
}
