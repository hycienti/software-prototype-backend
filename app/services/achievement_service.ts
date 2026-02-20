import type Achievement from '#models/achievement'
import AchievementRepository from '#repositories/achievement_repository'

const achievementRepository = new AchievementRepository()

export default class AchievementService {
  async listByUserId(
    userId: number,
    options?: { completed?: boolean }
  ): Promise<Achievement[]> {
    return achievementRepository.listByUserId(userId, options)
  }

  async getById(userId: number, id: number): Promise<Achievement> {
    return achievementRepository.findByIdAndUserId(id, userId)
  }
}
