import { FieldMessage } from "@/components/ui/field-message";
import type { Note } from "./reducer";

interface Props {
  note: Note;
  id?: string;
  className?: string;
  /** Form-level notices use assertive, field-side ones polite. */
  live?: "polite" | "assertive";
  hidden?: boolean;
}

/** One hint line below a field: a dot plus one sentence, coloured by tone. */
export function Msg({ note, id, className, live = "polite", hidden }: Props) {
  return (
    <FieldMessage className={className} tone={note.state || "default"} id={id} aria-live={live} hidden={hidden}>
      {note.text || null}
    </FieldMessage>
  );
}
