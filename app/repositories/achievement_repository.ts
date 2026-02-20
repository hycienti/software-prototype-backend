import { DateTime } from 'luxon'
import Achievement from '#models/achievement'

export default class AchievementRepository {
  async findByUserIdAndType(userId: number, type: string): Promise<Achievement | null> {
    return Achievement.query().where('user_id', userId).where('type', type).first()
  }

  async create(data: {
    userId: number
    type: string
    title: string
    description: string | null
    icon: string | null
    iconColor: string | null
    iconBgColor: string | null
    threshold: number | null
    progress: number
    isCompleted: boolean
    completedAt: DateTime | null
  }): Promise<Achievement> {
    return Achievement.create(data)
  }

  async save(achievement: Achievement): Promise<Achievement> {
    await achievement.save()
    return achievement
  }

  async findByIdAndUserId(id: number, userId: number): Promise<Achievement> {
    return Achievement.query().where('id', id).where('user_id', userId).firstOrFail()
  }

  async listByUserId(userId: number, options?: { completed?: boolean }): Promise<Achievement[]> {
    const query = Achievement.query().where('user_id', userId).orderBy('created_at', 'desc')
    if (options?.completed !== undefined) {
      query.where('is_completed', options.completed)
    }
    return query
  }
}
