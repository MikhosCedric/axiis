import { useId } from "react";
import { AreaMark } from "@/components/area-mark";
import { AREA_COLORS, areaColorLabel, type AreaColor } from "@/domain/area-color";

/** A colour's dot, or for None a dashed empty ring, so None reads as a choice rather than a gap. */
export function Swatch({ color, size }: { color: AreaColor | null; size: number }) {
  return color ? (
    <AreaMark color={color} size={size} />
  ) : (
    <span aria-hidden="true" className="rounded-full border-[1.5px] border-dashed border-ink-3" style={{ width: size, height: size }} />
  );
}

/**
 * The palette as a native radio group, None first: arrow keys move and choose, Tab leaves.
 * The chosen swatch is ringed in ink (selection is ink, not verdigris); focus keeps the global ring.
 * `name` is what the colour is for, as a person reads it ("Work", "#errands").
 */
export function ColorPicker({
  id,
  name,
  color,
  onPick,
}: {
  id: string;
  name: string;
  color: AreaColor | null;
  onPick: (color: AreaColor | null) => void;
}) {
  const group = useId();
  return (
    <fieldset id={id} className="col-span-full mt-1 mb-2 flex flex-wrap items-center gap-1 px-1">
      <legend className="sr-only">Colour for {name}</legend>
      {[null, ...AREA_COLORS].map((option) => (
        <label
          key={option ?? "none"}
          title={areaColorLabel(option)}
          className="relative grid size-8 cursor-pointer place-items-center rounded-full hover:bg-hover has-checked:shadow-[inset_0_0_0_1.5px_var(--ink)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent pointer-coarse:size-11"
        >
          <input
            type="radio"
            name={group}
            value={option ?? ""}
            checked={color === option}
            onChange={() => onPick(option)}
            className="absolute inset-0 m-0 size-full cursor-pointer appearance-none rounded-full opacity-0"
          />
          <span className="sr-only">{areaColorLabel(option)}</span>
          <Swatch color={option} size={16} />
        </label>
      ))}
      <span aria-hidden="true" className="ml-2 text-[13px] text-ink-2">
        {areaColorLabel(color)}
      </span>
    </fieldset>
  );
}

const iconButton =
  "grid size-8 pointer-coarse:size-11 place-items-center rounded-md text-ink-3 hover:bg-hover active:bg-press hover:text-ink";

/** The button that opens a row's picker, showing the colour it holds now. */
export function SwatchButton({
  name,
  color,
  open,
  controls,
  onToggle,
  className = "",
}: {
  name: string;
  color: AreaColor | null;
  open: boolean;
  controls: string;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      aria-label={`Colour for ${name}: ${areaColorLabel(color)}`}
      title="Colour"
      onClick={onToggle}
      className={`${iconButton} aria-expanded:bg-press ${className}`}
    >
      <Swatch color={color} size={12} />
    </button>
  );
}
