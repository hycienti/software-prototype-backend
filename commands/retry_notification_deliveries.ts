import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import notificationSendService from '#services/notification_send_service'

/**
 * Background job: process failed notification deliveries that have retries left.
 * Run via cron, e.g. every 5 minutes: node ace notification:retry_failed --limit=50
 */
export default class RetryNotificationDeliveriesCommand extends BaseCommand {
  static commandName = 'notification:retry_failed'

  static description = 'Retry failed notification deliveries (run as a cron job)'

  static options: CommandOptions = {
    startApp: true,
    allowUnknownFlags: false,
    staysAlive: false,
  }

  @flags.number({ default: 50, description: 'Max number of failed deliveries to process' })
  declare limit: number

  async run() {
    const limit = Math.min(Math.max(1, this.limit), 100)
    const { processed, succeeded } = await notificationSendService.processRetries(limit)
    this.logger.info(`Notification retries: ${succeeded}/${processed} succeeded`)
  }
}
