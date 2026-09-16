import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class IpBanModel extends BaseModel {
  static table = 'ip_bans'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare ip: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime()
  declare expiresAt: DateTime
}
