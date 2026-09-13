import { BaseCommand } from '@adonisjs/core/ace'
import env from '#start/env'
import { prisma } from '#db/prisma'
import { hashPassword } from '#utils/password'

export default class SeedAdmin extends BaseCommand {
  static commandName = 'db:seed'
  static description = 'Upsert the initial admin user from SEED_ADMIN_* environment variables'

  async run() {
    if (env.get('NODE_ENV') === 'production' && process.env.SEED_ALLOWED !== 'true') {
      this.logger.error('Refusing to seed in production. Set SEED_ALLOWED=true to override.')
      process.exitCode = 1
      return
    }

    const email = env.get('SEED_ADMIN_EMAIL')
    const password = env.get('SEED_ADMIN_PASSWORD')

    if (!email || !password) {
      this.logger.error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set to seed an admin.')
      process.exitCode = 1
      return
    }

    const passwordHash = await hashPassword(password)

    const user = await prisma.user.upsert({
      where: { email: email.toLowerCase() },
      update: { role: 'ADMIN', isActive: true, passwordHash },
      create: {
        name: 'Administrator',
        email: email.toLowerCase(),
        passwordHash,
        role: 'ADMIN',
      },
    })

    this.logger.success(`Seeded admin user: ${user.email} (${user.role})`)
  }
}
