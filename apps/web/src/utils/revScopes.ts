// Names of the change-marker scopes a screen can watch, mirroring the kinds the
// API accepts on GET /sync/rev. The inbox is asked for by project — the server
// answers with the session user's own, so the user id never appears here.
export const revScope = {
  board: (projectId: number) => `board:${projectId}`,
  issue: (issueId: number) => `issue:${issueId}`,
  initiative: (initiativeId: number) => `initiative:${initiativeId}`,
  inbox: (projectId: number) => `inbox:${projectId}`,
  documents: (projectId: number) => `documents:${projectId}`,
};
