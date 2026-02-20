import AvailabilitySlot from '#models/availability_slot'

export default class AvailabilitySlotRepository {
  async listByTherapistId(therapistId: number): Promise<AvailabilitySlot[]> {
    return AvailabilitySlot.query()
      .where('therapist_id', therapistId)
      .orderBy('sort_order')
  }

  async create(data: {
    therapistId: number
    type: 'recurring' | 'one_off'
    label?: string | null
    days?: number[] | null
    date?: import('luxon').DateTime | null
    startTime: string
    endTime: string
    sortOrder?: number
  }): Promise<AvailabilitySlot> {
    return AvailabilitySlot.create(data as any)
  }

  async delete(slot: AvailabilitySlot): Promise<void> {
    await slot.delete()
  }

  async deleteAllByTherapistId(therapistId: number): Promise<number> {
    const deleted = await AvailabilitySlot.query()
      .where('therapist_id', therapistId)
      .delete()
    return deleted as unknown as number
  }
}
