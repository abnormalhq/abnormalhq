import type { MouseEvent } from "react";

/*
 * Row helpers for Table. They live outside table.tsx on purpose: every export of a "use client" module reaches a
 * Server Component as a client reference, so a class string imported from there arrives as an object that cn drops
 * without a word. This module has no directive, so the helpers work the same from Server and Client Components.
 */

/**
 * Secondary actions inside a row (copy, edit, ⋯ menu): hidden normally, shown only when the mouse is over the row, keyboard focus is on the button, the menu is open, or it was just copied;
 * touch screens have no hover, so they are always shown. The row must carry `group/row`, which TableRow does.
 */
const rowActionClassName =
  "opacity-0 transition-opacity duration-150 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 data-[feedback=copied]:opacity-100 [@media(hover:none)]:opacity-100";

/** The click targets that open the details do not include these: buttons, links and inputs in the row keep handling their own clicks. */
const ROW_IGNORE =
  "a,button,input,textarea,select,label,summary,[role=checkbox],[role=combobox],[role=menuitem],[role=option],[data-row-ignore]";

/**
 * Click the whole row to open details: clicks on buttons, links or inputs in the row, or while selecting text, do not count;
 * clicks inside a dialog popped out of the row (Portal) also bubble up along the React tree, so only clicks that really land inside this row's DOM are accepted.
 * Keyboard users use the links / buttons the row already has; this is only a shortcut for the mouse.
 * It returns an event handler, so call it in a Client Component: `<TableRow onClick={rowClickHandler(open)}>`.
 */
function rowClickHandler(activate: (event: MouseEvent<HTMLTableRowElement>) => void) {
  return (event: MouseEvent<HTMLTableRowElement>) => {
    if (event.defaultPrevented || event.button !== 0) return;
    const target = event.target as Element;
    if (!event.currentTarget.contains(target) || target.closest(ROW_IGNORE)) return;
    if (window.getSelection()?.toString()) return;
    activate(event);
  };
}

export { rowActionClassName, rowClickHandler };
