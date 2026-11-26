import { useEffect, type RefObject } from "react";

/*
 * The edge fade and the sideways wheel of a scrolling row, for ScrollArea's `fade` and `strip` and for the row of
 * NavTabs, and the pointer focus of a box that scrolls, for ScrollArea and Table. They live in a file without
 * "use client", so another item, or a project's own row, can call them too.
 */

/** Which way a box scrolls, for the fade: sideways, up and down, or both. */
type ScrollAxis = "x" | "y" | "both";

/** How far the fade reaches into the box, in pixels: enough to read as "there is more this way". */
const FADE = 24;

/** One gradient along an axis, transparent at each end that still has content past it. */
function edgeMask(direction: "right" | "bottom", start: boolean, end: boolean) {
  if (!start && !end) return null;
  const from = start ? `transparent, #000 ${FADE}px` : "#000";
  const to = end ? `#000 calc(100% - ${FADE}px), transparent` : "#000";
  return `linear-gradient(to ${direction}, ${from}, ${to})`;
}

/**
 * How far a box has scrolled along its rows from their start, from 0 to `max`, in either reading direction: in a
 * right-to-left box scrollLeft runs from 0 down to -max, the start being on the right.
 */
function inlineScroll(element: HTMLElement) {
  const max = Math.max(0, element.scrollWidth - element.clientWidth);
  const rtl = getComputedStyle(element).direction === "rtl";
  return { max, rtl, done: Math.min(max, Math.max(0, rtl ? -element.scrollLeft : element.scrollLeft)) };
}

/**
 * Fades the edges of a scrolling box where content is hidden: the end while there is more past it, the start once the
 * box has been scrolled. A box that fits shows no fade. It is a mask, so it works over any background (a translucent
 * sticky bar included), and it is written straight onto the element's style, so scrolling never re-renders it.
 * In a right-to-left box the start is the right edge. Pass `null` as the axis to turn it off.
 */
function useScrollFade(ref: RefObject<HTMLElement | null>, axis: ScrollAxis | null = "x") {
  useEffect(() => {
    const element = ref.current;
    if (!element || axis === null) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      // Rounding of fractional sizes leaves a pixel or so at either end.
      const row = axis === "y" ? null : inlineScroll(element);
      // The mask runs left to right: the hidden start is on the right in a right-to-left box.
      const before = row && row.done > 1;
      const after = row && row.max - row.done > 1;
      const x = row === null ? null : edgeMask("right", !!(row.rtl ? after : before), !!(row.rtl ? before : after));
      const y =
        axis === "x"
          ? null
          : edgeMask(
              "bottom",
              element.scrollTop > 1,
              element.scrollHeight - element.clientHeight - element.scrollTop > 1,
            );
      const masks = [x, y].filter((mask) => mask !== null);
      element.style.maskImage = masks.join(", ");
      // Two masks show only where both do: each fades its own edges and leaves the rest of the box alone.
      element.style.maskComposite = masks.length > 1 ? "intersect" : "";
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    element.addEventListener("scroll", schedule, { passive: true });
    // The box's own size (the window, a sidebar collapsing) and its content (a count arriving, the language) both change
    // what is hidden.
    const resized = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
    resized?.observe(element);
    for (const child of element.children) resized?.observe(child);
    const changed = typeof MutationObserver === "undefined" ? undefined : new MutationObserver(schedule);
    changed?.observe(element, { childList: true, subtree: true, characterData: true });
    return () => {
      element.removeEventListener("scroll", schedule);
      resized?.disconnect();
      changed?.disconnect();
      if (frame) cancelAnimationFrame(frame);
      element.style.maskImage = "";
      element.style.maskComposite = "";
    };
  }, [ref, axis]);
}

/** Pixels per unit of a wheel event's delta: 1, a line of the element's text (deltaMode 1), or its width (2). */
function wheelUnit(event: WheelEvent, element: HTMLElement) {
  if (event.deltaMode === 1) {
    const style = getComputedStyle(element);
    // A line height of "normal" has no number: take the usual 1.2 of the font size.
    return parseFloat(style.lineHeight) || (parseFloat(style.fontSize) || 16) * 1.2;
  }
  if (event.deltaMode === 2) return element.clientWidth;
  return 1;
}

/**
 * Lets a vertical mouse wheel scroll a one-line row sideways, since a mouse has no horizontal wheel. A trackpad already
 * scrolls it, and a gesture that is mostly sideways, or a pinch (ctrlKey), is left alone. At either end the wheel goes
 * back to scrolling the page, so the row never traps it. Wheel down moves toward the end of the row, which is to the
 * left in a right-to-left box, and a wheel that counts in lines or pages (as Firefox can) moves as far as a line of
 * the row's text or the row's width. Pass `false` to turn it off.
 */
function useWheelSideways(ref: RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const { max, rtl, done } = inlineScroll(element);
      if (max <= 0) return;
      if ((event.deltaY < 0 && done <= 0) || (event.deltaY > 0 && done >= max)) return;
      event.preventDefault();
      const delta = event.deltaY * wheelUnit(event, element);
      element.scrollLeft += rtl ? -delta : delta;
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [ref, enabled]);
}

/**
 * Brings `item` into view inside the row `container` scrolls, centred, without moving the page: an item already in view
 * stays where it is. For the current tab of a row narrower than its tabs.
 */
function scrollIntoRow(container: HTMLElement, item: HTMLElement, behavior: ScrollBehavior = "auto") {
  const box = container.getBoundingClientRect();
  const rect = item.getBoundingClientRect();
  // Measured on screen, so it holds in either reading direction: a larger scrollLeft moves the content left in both.
  const start = rect.left - box.left;
  if (start >= 0 && start + rect.width <= container.clientWidth) return;
  const offset = start + rect.width / 2 - container.clientWidth / 2;
  container.scrollTo({ left: container.scrollLeft + offset, behavior });
}

/**
 * Tells focus that came from the pointer apart from the keyboard's, in a scrolling box and the rows inside it. A box
 * that scrolls is a tab stop, so the arrow keys can scroll it, and so a click inside it that lands on no control
 * focuses the box; a click on a row's button focuses that button. Chrome then matches `:focus-visible` from the next
 * key pressed, whatever the key: in a list that takes single keys (J, K, Escape), a click on a row and then Escape drew
 * a ring around the whole box, or around the row just closed. While the box, or an element inside it, holds focus that
 * did not start focus-visible (a click), that element carries `data-pointer-focus`, so its ring can be hidden
 * (`data-pointer-focus:outline-none`, or `:focus-visible:not([data-pointer-focus])` where a row draws it). Focus from
 * Tab, or moved by a script after a key, as J and K do, keeps the ring. A click that leaves the focus where it was
 * (on the box Tab had reached) marks it too, so the ring goes with the click; a touch that only pans the box does
 * not. The attribute goes with the focus.
 */
function usePointerFocus(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onFocusIn = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.matches(":focus-visible")) event.target.removeAttribute("data-pointer-focus");
      else event.target.setAttribute("data-pointer-focus", "");
    };
    const onFocusOut = (event: FocusEvent) => {
      if (event.target instanceof Element) event.target.removeAttribute("data-pointer-focus");
    };
    // A click on what already holds focus moves nothing, so no focusin follows: whatever holds focus inside the box
    // after a click is the pointer's. A click, not a press: a touch that pans the list is no click, and leaves a
    // keyboard ring alone. One from the keyboard (Enter or Space on a button) has no clicks to count, detail 0.
    const onClick = (event: MouseEvent) => {
      if (event.detail === 0) return;
      const active = document.activeElement;
      if (active && element.contains(active)) active.setAttribute("data-pointer-focus", "");
    };
    element.addEventListener("focusin", onFocusIn);
    element.addEventListener("focusout", onFocusOut);
    // Captured, so a handler inside that stops the click's propagation still lets the box see it.
    element.addEventListener("click", onClick, true);
    return () => {
      element.removeEventListener("focusin", onFocusIn);
      element.removeEventListener("focusout", onFocusOut);
      element.removeEventListener("click", onClick, true);
      for (const marked of element.querySelectorAll("[data-pointer-focus]"))
        marked.removeAttribute("data-pointer-focus");
      element.removeAttribute("data-pointer-focus");
    };
  }, [ref]);
}

export { useScrollFade, useWheelSideways, usePointerFocus, scrollIntoRow, type ScrollAxis };
