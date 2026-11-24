// t.Numeric()/t.Integer() render as a string|number anyOf repeating every constraint, in each
// tool definition on every step. Agents only need the number: dispatch.ts stringifies query args.
function isNumericStringBranch(node: unknown): boolean {
  if (typeof node !== 'object' || node === null) return false;
  const branch = node as Record<string, unknown>;
  if (branch.type !== 'string') return false;
  if (branch.format !== 'numeric' && branch.format !== 'integer') return false;
  for (const key of Object.keys(branch)) {
    if (key !== 'type' && key !== 'format' && key !== 'default') return false;
  }
  return !('default' in branch) || branch.default === 0;
}

function isNumericBranch(node: unknown): node is Record<string, unknown> {
  if (typeof node !== 'object' || node === null) return false;
  const type = (node as Record<string, unknown>).type;
  return type === 'number' || type === 'integer';
}

// Recurses through every nested schema position; only the exact string+number pair collapses,
// so enums, literal unions and nullable unions (whose inner anyOf collapses first) stay.
export function collapseNumericSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(collapseNumericSchema);
  if (typeof node !== 'object' || node === null) return node;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (
      key === 'properties' &&
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      const properties: Record<string, unknown> = {};
      for (const [name, propSchema] of Object.entries(value as Record<string, unknown>)) {
        properties[name] = collapseNumericSchema(propSchema);
      }
      out[key] = properties;
    } else if (key === 'items' || key === 'additionalProperties' || key === 'not') {
      out[key] = collapseNumericSchema(value);
    } else if (key === 'anyOf' || key === 'oneOf' || key === 'allOf') {
      out[key] = Array.isArray(value) ? value.map(collapseNumericSchema) : value;
    } else {
      out[key] = value;
    }
  }

  const branches = out.anyOf;
  if (!Array.isArray(branches) || branches.length !== 2) return out;
  const [first, second] = branches;
  let numberBranch: Record<string, unknown>;
  if (isNumericStringBranch(first) && isNumericBranch(second)) numberBranch = second;
  else if (isNumericStringBranch(second) && isNumericBranch(first)) numberBranch = first;
  else return out;
  const { anyOf: _anyOf, ...rest } = out;
  return { ...rest, ...numberBranch };
}
