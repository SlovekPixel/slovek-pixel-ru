import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'login_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('username', 64).notNullable()
      table.string('ip', 64).nullable()
      table.timestamp('created_at').notNullable()
      table.index(['created_at'], 'login_logs_created_at_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
