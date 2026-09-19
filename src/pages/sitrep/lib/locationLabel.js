/*
  The sitrep's Location, derived from the selected HQs: a parent that was
  expanded (its child units loaded) shows as just the parent's name with the
  number of its selected children in brackets ("Region HQ (12 HQs)"); other HQs show by name; several
  are listed together.
*/

/**
 * @param {Array<{id: string|number, name: string}>} units  the selected HQs, in selection order
 * @param {Record<string, string|number>} parentOf  childId -> the HQ it was expanded from
 * @returns {string}  e.g. "Region HQ (12 HQs), Parramatta Unit"
 */
export function buildLocationLabel(units, parentOf = {}) {
  const selected = new Set(units.map((u) => String(u.id)));
  const parentKey = (u) => (parentOf[u.id] != null ? String(parentOf[u.id]) : null);

  // a unit whose parent is no longer selected stands on its own
  const isRoot = (u) => {
    const p = parentKey(u);
    return p === null || !selected.has(p) || p === String(u.id);
  };

  const rootOf = (u) => {
    let current = u;
    const seen = new Set();
    while (!isRoot(current) && !seen.has(String(current.id))) {
      seen.add(String(current.id));
      current = units.find((x) => String(x.id) === parentKey(current)) || current;
    }
    return current;
  };

  const roots = units.filter(isRoot);
  return roots
    .map((root) => {
      const descendants = units.filter((u) => u !== root && String(rootOf(u).id) === String(root.id)).length;
      return descendants > 0 ? `${root.name} (${descendants} HQ${descendants === 1 ? '' : 's'})` : root.name;
    })
    .join(', ');
}
