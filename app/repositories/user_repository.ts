import User from '#models/user'

export default class UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    return User.findBy('email', email)
  }

  async findById(id: number): Promise<User> {
    return User.findOrFail(id)
  }

  async create(data: {
    email: string
    fullName: string | null
    emailVerified?: boolean
    lastLoginAt?: import('luxon').DateTime | null
  }): Promise<User> {
    return User.create(data)
  }

  async update(
    user: User,
    payload: {
      fullName?: string | null
      avatarUrl?: string | null
      emailVerified?: boolean
      lastLoginAt?: import('luxon').DateTime | null
    }
  ): Promise<User> {
    if (payload.fullName !== undefined) user.fullName = payload.fullName
    if (payload.avatarUrl !== undefined) user.avatarUrl = payload.avatarUrl
    if (payload.emailVerified !== undefined) user.emailVerified = payload.emailVerified
    if (payload.lastLoginAt !== undefined) user.lastLoginAt = payload.lastLoginAt
    await user.save()
    return user
  }

  async delete(user: User): Promise<void> {
    await user.delete()
  }
}
