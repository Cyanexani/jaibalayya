/* A stack of things the back button should close first: Bloom, context
   menus, the jump list, edit mode, the action center, the app switcher. */

const stack = [];

/** Register a close function; returns a function that unregisters it. */
export function pushOverlay(close) {
  stack.push(close);
  return () => {
    const i = stack.indexOf(close);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** Close the topmost overlay. Returns true if there was one. */
export function closeTop() {
  const close = stack.pop();
  if (!close) return false;
  close();
  return true;
}

export function closeAll() {
  const all = stack.splice(0).reverse();
  for (const close of all) close();
}

export const hasOverlay = () => stack.length > 0;
