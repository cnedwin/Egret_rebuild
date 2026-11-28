// SPDX-License-Identifier: Apache-2.0
// Read the browser's actual keyboard owner and, for an ARIA composite, the
// active descendant it owns. This is a browser test probe, not a product API.
export function readBrowserKeyboardFocus() {
  const owner = document.activeElement;
  if (!owner?.isConnected) return undefined;
  const box = element => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  };
  const visible = element => {
    if (!element?.isConnected || element.closest('[inert], [aria-hidden="true"]')) return false;
    const bounds = box(element);
    if (!(bounds.width > 0 && bounds.height > 0)) return false;
    // The accessibility projection is deliberately transparent; opacity is
    // not a visibility test for its geometry. A hidden layout has no bounds.
    return getComputedStyle(element).visibility === 'visible';
  };
  const describe = element => ({
    id: element.id,
    tag: element.tagName,
    role: element.getAttribute('role'),
    name: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '',
    tabIndex: element.getAttribute('tabindex'),
    bounds: box(element)
  });
  const ownerDescription = describe(owner);
  const id = owner.getAttribute('aria-activedescendant');
  if (!id) return { kind: 'dom', owner: ownerDescription, target: ownerDescription, visible: visible(owner) };
  const target = document.getElementById(id);
  const owned =
    target !== null &&
    (owner.contains(target) ||
      (owner.getAttribute('aria-owns') ?? '')
        .split(/\s+/u)
        .filter(Boolean)
        .some(ownedId => {
          const root = document.getElementById(ownedId);
          return root !== null && root.isConnected && (root === target || root.contains(target));
        }));
  if (
    !owned ||
    !visible(owner) ||
    !visible(target) ||
    target.getAttribute('aria-disabled') === 'true' ||
    ('disabled' in target && target.disabled === true)
  )
    return { kind: 'invalid-active-descendant', owner: ownerDescription, targetId: id };
  return { kind: 'active-descendant', owner: ownerDescription, target: describe(target), visible: true };
}
