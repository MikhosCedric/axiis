import type { ItemType } from "@/domain/item";
import type { BeamState } from "./model";
import styles from "./glyph.module.css";

export function Glyph({ type, state, justDone = false }: { type: ItemType; state: BeamState; justDone?: boolean }) {
  const cls = [styles.glyph, styles[state], styles[type], justDone ? styles.justDone : ""].join(" ");
  return (
    <span className={cls} aria-hidden="true">
      <span className={styles.beam}>
        <span className={styles.sweep} />
      </span>
      <span className={styles.head} />
    </span>
  );
}
