export class LoginAttempt {
  constructor(
    readonly username: string,
    readonly ip: string | null,
    readonly createdAt: Date,
    readonly success: boolean,
    readonly id?: number
  ) {}
}
