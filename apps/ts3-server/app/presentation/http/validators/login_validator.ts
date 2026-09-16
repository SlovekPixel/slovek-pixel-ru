import vine from '@vinejs/vine'

export const loginValidator = vine.create({
  username: vine.string().trim().minLength(1).maxLength(64),
  password: vine.string().minLength(1).maxLength(64),
})
