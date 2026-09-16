import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'login_logs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('success').notNullable().defaultTo(false)
      table.index(['ip', 'success', 'created_at'], 'login_logs_ip_success_created_at_index')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['ip', 'success', 'created_at'], 'login_logs_ip_success_created_at_index')
      table.dropColumn('success')
    })
  }
}
