import { memo } from 'react';
import type { GroceryItem } from '../api/items';
import { IconButton } from './IconButton';
import { IconPencil, IconTrash } from './icons';

type CheckedItemsSectionProps = {
  items: GroceryItem[];
  onUncheck: (item: GroceryItem) => void;
  onEdit: (item: GroceryItem) => void;
  onDelete: (item: GroceryItem) => void;
};

const CheckedItemRow = memo(function CheckedItemRow({
  item,
  onUncheck,
  onEdit,
  onDelete,
}: {
  item: GroceryItem;
  onUncheck: (item: GroceryItem) => void;
  onEdit: (item: GroceryItem) => void;
  onDelete: (item: GroceryItem) => void;
}) {
  const metaParts = [item.quantity, item.note, item.category.name].filter(
    Boolean
  );

  return (
    <li className="item-row card item-row-checked">
      <span className="drag-handle-spacer" aria-hidden />
      <label className="item-check">
        <input
          type="checkbox"
          checked
          onChange={() => onUncheck(item)}
          aria-label={`Uncheck ${item.name}`}
        />
        <span className="item-check-box" aria-hidden />
      </label>
      <button
        type="button"
        className="item-row-body item-row-toggle"
        onClick={() => onUncheck(item)}
        aria-label={`Uncheck ${item.name}`}
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
 * Flat list of recently crossed-off items (newest first).
 * Unchecking restores the item to its category in the active list.
 */
export function CheckedItemsSection({
  items,
  onUncheck,
  onEdit,
  onDelete,
}: CheckedItemsSectionProps) {
  if (items.length === 0) return null;

  return (
    <section
      className="checked-items-section"
      aria-labelledby="checked-items-heading"
    >
      <h3 id="checked-items-heading" className="checked-items-heading">
        Crossed off
        <span className="category-group-count muted">{items.length}</span>
      </h3>
      <ul className="item-rows">
        {items.map((item) => (
          <CheckedItemRow
            key={item.id}
            item={item}
            onUncheck={onUncheck}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </section>
  );
}
