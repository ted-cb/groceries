import { useMemo, useState } from 'react';
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
import { arrayMove } from '../dnd/arrayMove';
import { useListSensors } from '../dnd/sensors';

type SortableItemGroupProps = {
  items: GroceryItem[];
  onReorder: (orderedIds: string[]) => void;
  onToggleChecked: (item: GroceryItem) => void;
  onEdit: (item: GroceryItem) => void;
  onDelete: (item: GroceryItem) => void;
};

function SortableItemRow({
  item,
  onToggleChecked,
  onEdit,
  onDelete,
}: {
  item: GroceryItem;
  onToggleChecked: (item: GroceryItem) => void;
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

  const rowClass = [
    'item-row',
    'card',
    item.isChecked ? 'item-row-checked' : '',
    isDragging ? 'item-row-dragging' : '',
  ]
    .filter(Boolean)
    .join(' ');

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
          checked={item.isChecked}
          onChange={() => onToggleChecked(item)}
          aria-label={
            item.isChecked
              ? `Uncheck ${item.name}`
              : `Check off ${item.name}`
          }
        />
        <span className="item-check-box" aria-hidden />
      </label>
      <button
        type="button"
        className="item-row-body item-row-toggle"
        onClick={() => onToggleChecked(item)}
        aria-pressed={item.isChecked}
        aria-label={
          item.isChecked
            ? `Uncheck ${item.name}`
            : `Check off ${item.name}`
        }
      >
        <span className="item-name">{item.name}</span>
        {(item.quantity || item.note) && (
          <span className="item-meta muted small">
            {item.quantity && <span>{item.quantity}</span>}
            {item.quantity && item.note && (
              <span className="meta-sep" aria-hidden>
                ·
              </span>
            )}
            {item.note && <span>{item.note}</span>}
          </span>
        )}
      </button>
      <div className="item-row-actions">
        <button
          type="button"
          className="btn secondary btn-sm"
          onClick={() => onEdit(item)}
        >
          Edit
        </button>
        <button
          type="button"
          className="btn danger-outline btn-sm"
          onClick={() => onDelete(item)}
        >
          Delete
        </button>
      </div>
    </li>
  );
}

/**
 * Sortable list of items that share the same category and checked state.
 * Separate instances keep drag scoped so order does not fight check-off grouping.
 */
export function SortableItemGroup({
  items,
  onReorder,
  onToggleChecked,
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
              onToggleChecked={onToggleChecked}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      </SortableContext>
      <DragOverlay>
        {activeItem ? (
          <div
            className={
              activeItem.isChecked
                ? 'item-row card item-row-checked drag-overlay-card'
                : 'item-row card drag-overlay-card'
            }
          >
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
