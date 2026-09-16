import vine from '@vinejs/vine'

export const unbanIpValidator = vine.create({
  ip: vine.string().trim().minLength(1).maxLength(64),
})
