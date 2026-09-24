ALTER TABLE "team" ADD COLUMN "default_agent_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;
