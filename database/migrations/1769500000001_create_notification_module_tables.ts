import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('notification_channels', (table) => {
      table.increments('id').primary()
      table.string('name', 64).notNullable()
      table.string('slug', 32).notNullable().unique()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })

    this.schema.createTable('notification_categories', (table) => {
      table.increments('id').primary()
      table.string('name', 64).notNullable()
      table.string('slug', 32).notNullable().unique()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })

    this.schema.createTable('notification_types', (table) => {
      table.increments('id').primary()
      table
        .integer('category_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('notification_categories')
        .onDelete('RESTRICT')
      table.string('name', 128).notNullable()
      table.string('slug', 64).notNullable().unique()
      table.text('description').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })

    this.schema.createTable('notification_templates', (table) => {
      table.increments('id').primary()
      table
        .integer('notification_type_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('notification_types')
        .onDelete('CASCADE')
      table
        .integer('channel_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('notification_channels')
        .onDelete('RESTRICT')
      table.string('product_type', 32).notNullable() // 'user' | 'therapist'
      table.string('locale', 8).notNullable().defaultTo('en')
      table.string('subject', 255).nullable() // for email
      table.text('body_html').notNullable()
      table.text('body_text').nullable()
      table.jsonb('template_variables').nullable() // e.g. ["otpCode", "recipientName", "expiresInMinutes"]
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })

    this.schema.createTable('notification_deliveries', (table) => {
      table.increments('id').primary()
      table.string('recipient_type', 32).notNullable() // 'user' | 'therapist'
      table.integer('recipient_id').unsigned().notNullable()
      table
        .integer('channel_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('notification_channels')
        .onDelete('RESTRICT')
      table
        .integer('notification_type_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('notification_types')
        .onDelete('RESTRICT')
      table
        .integer('template_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('notification_templates')
        .onDelete('SET NULL')
      table.string('status', 24).notNullable().defaultTo('pending') // pending | sent | failed
      table.integer('retry_count').unsigned().notNullable().defaultTo(0)
      table.integer('max_retries').unsigned().notNullable().defaultTo(3)
      table.text('last_error').nullable()
      table.jsonb('metadata').nullable() // e.g. { email, resendId }
      table.timestamp('sent_at').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
      table.index(['status', 'retry_count'])
    })

    this.schema.alterTable('notifications', (table) => {
      table
        .integer('notification_type_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('notification_types')
        .onDelete('SET NULL')
      table
        .integer('category_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('notification_categories')
        .onDelete('SET NULL')
      table
        .integer('delivery_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('notification_deliveries')
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable('notifications', (table) => {
      table.dropColumn('notification_type_id')
      table.dropColumn('category_id')
      table.dropColumn('delivery_id')
    })
    this.schema.dropTableIfExists('notification_deliveries')
    this.schema.dropTableIfExists('notification_templates')
    this.schema.dropTableIfExists('notification_types')
    this.schema.dropTableIfExists('notification_categories')
    this.schema.dropTableIfExists('notification_channels')
  }
}
