import { prisma } from '#db/prisma'

const TABLES = [
  'publishing_jobs',
  'post_publications',
  'post_assets',
  'assets',
  'bible_verse_posts',
  'posts',
  'canva_templates',
  'social_pages',
  'social_accounts',
  'audit_logs',
  'sessions',
  'users',
]

export async function cleanDb() {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.join(', ')} CASCADE`)
}
