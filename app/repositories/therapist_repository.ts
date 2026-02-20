import { DateTime } from 'luxon'
import Therapist from '#models/therapist'
export default class TherapistRepository {
  async findById(id: number): Promise<Therapist | null> {
    return Therapist.find(id)
  }

  async findByEmail(email: string): Promise<Therapist | null> {
    return Therapist.findBy('email', email)
  }

  async list(options: {
    page: number
    limit: number
    search?: string
  }): Promise<{ data: Therapist[]; total: number }> {
    const q = Therapist.query()
    if (options.search?.trim()) {
      const term = `%${options.search.trim()}%`
      q.where((builder) => {
        builder
          .whereRaw('LOWER(full_name) LIKE ?', [term.toLowerCase()])
          .orWhereRaw('LOWER(professional_title) LIKE ?', [term.toLowerCase()])
      })
    }
    const total = await q.clone().count('* as total').first()
    const totalCount = Number(total?.$extras?.total ?? 0)
    const data = await q
      .orderBy('fullName', 'asc')
      .offset((options.page - 1) * options.limit)
      .limit(options.limit)
    return { data, total: totalCount }
  }

  async create(data: {
    email: string
    fullName?: string | null
    professionalTitle?: string | null
    emailVerified?: boolean
    lastLoginAt?: DateTime | null
    [key: string]: any
  }): Promise<Therapist> {
    return Therapist.create(data)
  }

  async update(therapist: Therapist, payload: Partial<Therapist>): Promise<Therapist> {
    therapist.merge(payload)
    await therapist.save()
    return therapist
  }
}
