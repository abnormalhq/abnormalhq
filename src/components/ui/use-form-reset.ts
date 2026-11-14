import { useEffect, useRef, type RefObject } from "react";

/*
 * The hook behind the form reset of Switch, Combobox, DatePicker, DateRangePicker and InputOTP: fields that keep
 * their value in React state and submit it through a hidden input, or through an input React keeps in step with that
 * state, neither of which a form reset puts back. It lives in its own file without "use client", so a project's own
 * field can call it too.
 */

/**
 * Calls `onReset` when the form that owns `field` has been reset, as a native field would be: by a reset button,
 * form.reset(), or the reset React runs after a form action. `field` is any element with a form owner (a button, an
 * input, a hidden input), found as an ancestor or through the form attribute.
 * A reset can be cancelled (`<form onReset={(event) => event.preventDefault()}>`), and native fields then keep their
 * values. Nothing says so while the event is still travelling: React's own handlers run at the root, after the
 * form's listeners. So the hook waits until the dispatch is over and calls `onReset` only if nobody cancelled it.
 * A reset from a script has finished by the next microtask; one from a click on a reset button has not, since
 * microtasks run between its listeners, and is checked in a task of its own.
 */
function useFormReset(field: RefObject<{ form: HTMLFormElement | null } | null>, onReset: () => void) {
  const latest = useRef(onReset);
  useEffect(() => {
    latest.current = onReset;
  });
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // Without a dependency list: the owner is read again after every render, so a field that appears later, or moves
  // to another form, is followed without the caller listing what can move it.
  useEffect(() => {
    const owner = field.current?.form;
    if (!owner) return;
    const settle = (event: Event) => {
      if (mounted.current && !event.defaultPrevented) latest.current();
    };
    const reset = (event: Event) => {
      queueMicrotask(() => {
        if (event.eventPhase === Event.NONE) settle(event);
        else setTimeout(() => settle(event));
      });
    };
    owner.addEventListener("reset", reset);
    return () => owner.removeEventListener("reset", reset);
  });
}

export { useFormReset };
