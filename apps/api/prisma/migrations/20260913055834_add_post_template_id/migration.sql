-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "template_id" UUID;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "canva_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
