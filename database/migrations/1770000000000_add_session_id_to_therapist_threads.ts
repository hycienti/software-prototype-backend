import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'therapist_threads'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('session_id')
        .unsigned()
        .references('sessions.id')
        .onDelete('SET NULL')
        .nullable()
    })
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['user_id', 'therapist_id'])
    })
    // One thread per session when session_id is set
    this.schema.raw(
      'CREATE UNIQUE INDEX therapist_threads_session_id_unique ON therapist_threads (session_id) WHERE session_id IS NOT NULL'
    )
    // Legacy: one unscoped thread per (user, therapist)
    this.schema.raw(
      'CREATE UNIQUE INDEX therapist_threads_user_therapist_legacy_unique ON therapist_threads (user_id, therapist_id) WHERE session_id IS NULL'
    )
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS therapist_threads_session_id_unique')
    this.schema.raw('DROP INDEX IF EXISTS therapist_threads_user_therapist_legacy_unique')
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('session_id')
      table.unique(['user_id', 'therapist_id'])
    })
  }
}
