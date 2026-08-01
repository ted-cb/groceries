import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';

type DragHandleProps = {
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners | undefined;
  label: string;
  disabled?: boolean;
};

/** Touch-friendly grip control; attach dnd-kit listeners only here. */
export function DragHandle({
  attributes,
  listeners,
  label,
  disabled = false,
}: DragHandleProps) {
  return (
    <button
      type="button"
      className="drag-handle"
      aria-label={label}
      disabled={disabled}
      {...attributes}
      {...listeners}
    >
      <span className="drag-handle-icon" aria-hidden>
        <span />
        <span />
        <span />
      </span>
    </button>
  );
}
