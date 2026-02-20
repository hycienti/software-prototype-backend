import { DateTime } from 'luxon'
import Session from '#models/session'
import { SessionStatus } from '#enums/session'

export default class SessionRepository {
  async findById(id: number): Promise<Session | null> {
    return Session.query().where('id', id).first()
  }

  async findByIdWithRelations(id: number): Promise<Session | null> {
    return Session.query()
      .where('id', id)
      .preload('user')
      .preload('therapist')
      .first()
  }

  async findByIdAndTherapistId(id: number, therapistId: number): Promise<Session | null> {
    return Session.query()
      .where('id', id)
      .where('therapist_id', therapistId)
      .first()
  }

  async findByIdAndUserId(id: number, userId: number): Promise<Session | null> {
    return Session.query()
      .where('id', id)
      .where('user_id', userId)
      .first()
  }

  async create(data: {
    userId: number | null
    therapistId: number
    availabilitySlotId: number | null
    scheduledAt: DateTime
    durationMinutes: number
    status: SessionStatus
  }): Promise<Session> {
    return Session.create(data)
  }

  async listByTherapistId(
    therapistId: number,
    options: { page: number; limit: number; status?: string }
  ): Promise<{ data: Session[]; total: number }> {
    const baseQuery = Session.query().where('therapist_id', therapistId)
    if (options.status) {
      baseQuery.where('status', options.status)
    }
    const total = await baseQuery.clone().count('* as total').first()
    const totalCount = Number(total?.$extras?.total ?? 0)
    const dataQuery = Session.query()
      .where('therapist_id', therapistId)
      .preload('user')
      .preload('therapist')
      .orderBy('scheduled_at', 'desc')
    if (options.status) {
      dataQuery.where('status', options.status)
    }
    const data = await dataQuery
      .offset((options.page - 1) * options.limit)
      .limit(options.limit)
    return { data, total: totalCount }
  }

  async listByUserId(
    userId: number,
    options: { page: number; limit: number; status?: string }
  ): Promise<{ data: Session[]; total: number }> {
    const baseQuery = Session.query().where('user_id', userId)
    if (options.status) {
      baseQuery.where('status', options.status)
    }
    const total = await baseQuery.clone().count('* as total').first()
    const totalCount = Number(total?.$extras?.total ?? 0)
    const dataQuery = Session.query()
      .where('user_id', userId)
      .preload('user')
      .preload('therapist')
      .orderBy('scheduled_at', 'desc')
    if (options.status) {
      dataQuery.where('status', options.status)
    }
    const data = await dataQuery
      .offset((options.page - 1) * options.limit)
      .limit(options.limit)
    return { data, total: totalCount }
  }

  async update(
    session: Session,
    payload: {
      meetingId?: string | null
      status?: SessionStatus
      sentiment?: string | null
      engagementLevel?: number | null
      clinicalNotes?: string | null
      followUpAt?: DateTime | null
      summaryCompletedAt?: DateTime | null
      userSummaryMainTopics?: string[] | null
      userSummaryActionItems?: string[] | null
      userSummaryKeyReflection?: string | null
    }
  ): Promise<Session> {
    session.merge(payload as any)
    await session.save()
    return session
  }

  /** Count sessions for dashboard stats. */
  async countByTherapistIdAndFilters(
    therapistId: number,
    filters: {
      dateFrom?: DateTime
      dateTo?: DateTime
      status?: SessionStatus
      statusIn?: SessionStatus[]
    }
  ): Promise<number> {
    const q = Session.query().where('therapist_id', therapistId)
    if (filters.dateFrom) q.where('scheduled_at', '>=', filters.dateFrom.toSQL()!)
    if (filters.dateTo) q.where('scheduled_at', '<=', filters.dateTo.toSQL()!)
    if (filters.status) q.where('status', filters.status)
    if (filters.statusIn?.length) q.whereIn('status', filters.statusIn)
    const r = await q.count('* as total').first()
    return Number(r?.$extras?.total ?? 0)
  }

  /** List all sessions by therapist with user preloaded (for clients aggregation). */
  async listByTherapistIdWithUser(therapistId: number): Promise<Session[]> {
    return Session.query()
      .where('therapist_id', therapistId)
      .preload('user')
      .orderBy('scheduled_at', 'desc')
  }

  /** Next scheduled session for therapist + user. */
  async findNextScheduledForTherapistAndUser(
    therapistId: number,
    userId: number
  ): Promise<Session | null> {
    return Session.query()
      .where('therapist_id', therapistId)
      .where('user_id', userId)
      .where('status', SessionStatus.SCHEDULED)
      .where('scheduled_at', '>=', DateTime.now().toSQL()!)
      .orderBy('scheduled_at', 'asc')
      .first()
  }
}
