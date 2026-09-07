-- An agent's role is the one its project_member row carries, per project, like a
-- person's. 0115 already copied ai_agent.role_id onto every membership of the bot
-- user; a membership added since then without a role would fall back to the default
-- matrix, which can be wider than the agent's role, so it takes that role here.
UPDATE "project_member" m
   SET "role_id" = a."role_id"
  FROM "ai_agent" a
 WHERE a."user_id" = m."user_id" AND m."role_id" IS NULL;--> statement-breakpoint
ALTER TABLE "ai_agent" DROP CONSTRAINT "ai_agent_role_id_team_role_id_fk";--> statement-breakpoint
ALTER TABLE "ai_agent" DROP COLUMN "role_id";
