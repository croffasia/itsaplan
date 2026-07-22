// Thrown by coerceConfig when a submitted config is invalid (a missing required
// field or an uncoercible value). The API layer maps this to a 400 response; the
// package itself does not depend on any HTTP framework.
export class ToolConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolConfigError';
  }
}
