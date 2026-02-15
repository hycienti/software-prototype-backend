import { BaseSchema } from '@adonisjs/lucid/schema'
import db from '@adonisjs/lucid/services/db'

export default class extends BaseSchema {
  protected tableName = 'therapists'

  async up() {
    const therapists = await db.from('therapists').select('id', 'availability_slots') as { id: number; availability_slots: unknown }[]
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
    for (const t of therapists) {
      const slots = t.availability_slots as unknown[] | null
      if (!Array.isArray(slots) || slots.length === 0) continue
      let sortOrder = 0
      for (const slot of slots) {
        const s = slot as Record<string, unknown>
        const type = (s.type as string) || (s.date ? 'one_off' : 'recurring')
        const days = type === 'recurring' && Array.isArray(s.days) ? JSON.stringify(s.days) : null
        const date = type === 'one_off' && typeof s.date === 'string' ? s.date : null
        const startTime = (s.startTime as string) || '09:00'
        const endTime = (s.endTime as string) || '17:00'
        const label = typeof s.label === 'string' ? s.label : null
        await db.table('availability_slots').insert({
          therapist_id: t.id,
          type,
          label,
          days,
          date,
          start_time: startTime,
          end_time: endTime,
          sort_order: sortOrder++,
          created_at: now,
          updated_at: now,
        })
      }
    }
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('availability_slots')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('availability_slots').nullable()
    })
    // Optionally repopulate from availability_slots; for simplicity we leave column null on rollback
  }
}
