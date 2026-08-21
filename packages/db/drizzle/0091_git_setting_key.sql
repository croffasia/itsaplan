-- The GitHub integration became the repository integration: one config per project,
-- serving GitHub, GitLab, Gitea, Forgejo, and Bitbucket. The row keeps its webhook id
-- and secret, so webhooks already registered on a repository keep working.
UPDATE "project_setting" SET "key" = 'git' WHERE "key" = 'github';
