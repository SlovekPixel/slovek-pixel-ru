import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ip_bans'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('ip', 64).notNullable().unique()
      table.timestamp('created_at').notNullable()
      table.timestamp('expires_at').notNullable()
      table.index(['expires_at'], 'ip_bans_expires_at_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
