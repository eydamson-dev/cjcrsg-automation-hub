import env from '#start/env'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client.js'

const adapter = new PrismaPg({ connectionString: env.get('DATABASE_URL') })

export const prisma = new PrismaClient({ adapter })
