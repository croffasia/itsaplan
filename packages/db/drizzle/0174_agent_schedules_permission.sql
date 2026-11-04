-- Schedules get a resource of their own. Every role keeps what it could do with them: it
-- holds in agent_schedules exactly what it holds in ai_agents.
UPDATE "team_role"
   SET "permissions" = jsonb_set("permissions", '{agent_schedules}', "permissions" -> 'ai_agents')
 WHERE "permissions" -> 'ai_agents' IS NOT NULL;
