import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Adds voice_url and attachment_urls for therapist chat voice/attachments.
 * Required for POST /therapist-threads/:id/messages with voiceUrl/attachmentUrls.
 * Run: node ace migration:run
 */
export default class extends BaseSchema {
  protected tableName = 'therapist_thread_messages'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('voice_url', 2048).nullable()
      table.text('attachment_urls').nullable() // JSON array of URLs
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('voice_url')
      table.dropColumn('attachment_urls')
    })
  }
}
