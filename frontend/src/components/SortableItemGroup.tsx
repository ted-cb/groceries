import { memo, useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { GroceryItem } from '../api/items';
import { DragHandle } from './DragHandle';
import { IconButton } from './IconButton';
import { IconPencil, IconTrash } from './icons';
import { arrayMove } from '../dnd/arrayMove';
import { useListSensors } from '../dnd/sensors';

type SortableItemGroupProps = {
  items: GroceryItem[];
  onReorder: (orderedIds: string[]) => void;
  /** Phase D: check-off removes the item from the list. */
  onComplete: (item: GroceryItem) => void;
  onEdit: (item: GroceryItem) => void;
  onDelete: (item: GroceryItem) => void;
};

const SortableItemRow = memo(function SortableItemRow({
  item,
  onComplete,
  onEdit,
  onDelete,
}: {
  item: GroceryItem;
  onComplete: (item: GroceryItem) => void;
  onEdit: (item: GroceryItem) => void;
  onDelete: (item: GroceryItem) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const rowClass = ['item-row', 'card', isDragging ? 'item-row-dragging' : '']
    .filter(Boolean)
    .join(' ');

  const metaParts = [item.quantity, item.note].filter(Boolean);

  return (
    <li ref={setNodeRef} style={style} className={rowClass}>
      <DragHandle
        attributes={attributes}
        listeners={listeners}
        label={`Drag to reorder ${item.name}`}
      />
      <label className="item-check">
        <input
          type="checkbox"
          checked={false}
          onChange={() => onComplete(item)}
          aria-label={`Check off ${item.name}`}
        />
        <span className="item-check-box" aria-hidden />
      </label>
      <button
        type="button"
        className="item-row-body item-row-toggle"
        onClick={() => onComplete(item)}
        aria-label={`Check off ${item.name}`}
      >
        <span className="item-name">{item.name}</span>
        {metaParts.length > 0 && (
          <span className="item-meta muted">
            <span className="meta-sep" aria-hidden>
              ·
            </span>
            {metaParts.join(' · ')}
          </span>
        )}
      </button>
      <div className="item-row-actions">
        <IconButton
          label={`Edit ${item.name}`}
          size="sm"
          onClick={() => onEdit(item)}
        >
          <IconPencil />
        </IconButton>
        <IconButton
          label={`Delete ${item.name}`}
          size="sm"
          variant="danger"
          onClick={() => onDelete(item)}
        >
          <IconTrash />
        </IconButton>
      </div>
    </li>
  );
});

/**
 * Sortable list of items in one category.
 * Check-off completes (removes) the item; order is scoped to this group.
 */
export function SortableItemGroup({
  items,
  onReorder,
  onComplete,
  onEdit,
  onDelete,
}: SortableItemGroupProps) {
  const sensors = useListSensors();
  const [activeId, setActiveId] = useState<string | null>(null);
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const activeItem = activeId
    ? items.find((i) => i.id === activeId) ?? null
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    onReorder(reordered.map((i) => i.id));
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  if (items.length === 0) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="item-rows">
          {items.map((item) => (
            <SortableItemRow
              key={item.id}
              item={item}
              onComplete={onComplete}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      </SortableContext>
      <DragOverlay>
        {activeItem ? (
          <div className="item-row card drag-overlay-card">
            <span className="drag-handle drag-handle-static" aria-hidden>
              <span className="drag-handle-icon">
                <span />
                <span />
                <span />
              </span>
            </span>
            <div className="item-row-body">
              <span className="item-name">{activeItem.name}</span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
