// What the `@/cloud` alias resolves to in this repository: the stubs a self-hosted
// instance runs. The hosted build points the alias at its own module exporting the
// same names, so a cloud-only part is imported from here and nowhere else.
export { default as NoTeamStart } from './NoTeamStart';
export { default as useWorkspaceSections } from './useWorkspaceSections';
export { default as WorkspaceRailActions } from './WorkspaceRailActions';
