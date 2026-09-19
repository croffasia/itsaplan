ALTER TABLE "studio_template" DROP CONSTRAINT "studio_template_layout_check";--> statement-breakpoint
ALTER TABLE "studio_template" ALTER COLUMN "layout" SET DEFAULT 'statement';--> statement-breakpoint
ALTER TABLE "studio_template" ALTER COLUMN "background_color" SET DEFAULT '#000000';--> statement-breakpoint
ALTER TABLE "studio_template" ALTER COLUMN "accent_color" SET DEFAULT '#9ca3af';--> statement-breakpoint
ALTER TABLE "studio_post" ADD COLUMN "lead_line" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "studio_post" ADD COLUMN "chips" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "studio_post" ADD COLUMN "cta_label" text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE "studio_template" SET "layout" = CASE "layout"
  WHEN 'banner' THEN 'statement'
  WHEN 'quote' THEN 'overlay'
  WHEN 'stat' THEN 'statement'
  ELSE "layout"
END WHERE "layout" NOT IN ('statement', 'feature', 'announcement', 'overlay');--> statement-breakpoint
ALTER TABLE "studio_template" ADD CONSTRAINT "studio_template_layout_check" CHECK ("studio_template"."layout" IN ('statement', 'feature', 'announcement', 'overlay'));