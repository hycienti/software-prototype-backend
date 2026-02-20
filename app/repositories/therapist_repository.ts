import { DateTime } from 'luxon'
import Therapist from '#models/therapist'
export default class TherapistRepository {
  async findById(id: number): Promise<Therapist | null> {
    return Therapist.find(id)
  }

  async findByEmail(email: string): Promise<Therapist | null> {
    return Therapist.findBy('email', email)
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
