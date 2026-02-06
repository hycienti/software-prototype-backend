import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'therapist_wallets'

  async up() {
    this.schema.createTable('therapist_wallets', (table) => {
      table.increments('id').notNullable()
      table.integer('therapist_id').unsigned().references('therapists.id').onDelete('CASCADE').notNullable().unique()
      table.bigInteger('balance_cents').defaultTo(0).notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    this.schema.createTable('therapist_transactions', (table) => {
      table.increments('id').notNullable()
      table.integer('therapist_id').unsigned().references('therapists.id').onDelete('CASCADE').notNullable()
      table.bigInteger('amount_cents').notNullable() // positive = credit, negative = debit
      table.string('type', 32).notNullable() // session_payment, withdrawal, adjustment
      table.string('description', 255).nullable()
      table.integer('session_id').unsigned().references('sessions.id').onDelete('SET NULL').nullable()
      table.integer('withdrawal_id').unsigned().nullable() // ref to therapist_withdrawals
      table.timestamp('created_at').notNullable()
    })

    this.schema.createTable('therapist_withdrawals', (table) => {
      table.increments('id').notNullable()
      table.integer('therapist_id').unsigned().references('therapists.id').onDelete('CASCADE').notNullable()
      table.bigInteger('amount_cents').notNullable()
      table.string('status', 32).defaultTo('pending').notNullable() // pending, completed, failed
      table.string('reference', 128).nullable() // external payout id
      table.timestamp('requested_at').notNullable()
      table.timestamp('completed_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable('therapist_withdrawals')
    this.schema.dropTable('therapist_transactions')
    this.schema.dropTable('therapist_wallets')
  }
}
