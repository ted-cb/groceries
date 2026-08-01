import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import * as itemMemoriesApi from '../api/itemMemories';
import type { ItemMemory } from '../api/itemMemories';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const SEARCH_DEBOUNCE_MS = 200;
const MIN_QUERY_LENGTH = 1;

type ItemNameComboboxProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Apply a remembered item (name + category) into the parent form. */
  onPick: (memory: ItemMemory) => void;
  disabled?: boolean;
  inputRef?: RefObject<HTMLInputElement>;
  placeholder?: string;
  maxLength?: number;
};

/**
 * Accessible combobox for quick-add: debounced server search of item memories.
 * Enter with a highlighted option applies the suggestion; Enter with none submits the form.
 */
export function ItemNameCombobox({
  id,
  value,
  onChange,
  onPick,
  disabled = false,
  inputRef,
  placeholder = 'Add an item…',
  maxLength = 200,
}: ItemNameComboboxProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const debouncedQuery = useDebouncedValue(value.trim(), SEARCH_DEBOUNCE_MS);
  const canSearch = debouncedQuery.length >= MIN_QUERY_LENGTH;

  const searchQuery = useQuery({
    queryKey: ['item-memories', 'search', debouncedQuery],
    queryFn: async () => {
      const data = await itemMemoriesApi.searchItemMemories(debouncedQuery);
      return data.itemMemories;
    },
    enabled: canSearch,
    staleTime: 30_000,
  });

  const suggestions = canSearch ? (searchQuery.data ?? []) : [];
  const showList =
    open &&
    canSearch &&
    value.trim().length >= MIN_QUERY_LENGTH &&
    (searchQuery.isFetching || suggestions.length > 0 || searchQuery.isFetched);

  // Keep highlight in range when results change.
  useEffect(() => {
    setHighlightIndex((prev) => {
      if (suggestions.length === 0) return -1;
      if (prev < 0) return -1;
      return Math.min(prev, suggestions.length - 1);
    });
  }, [suggestions]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setHighlightIndex(-1);
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function applySuggestion(memory: ItemMemory) {
    onPick(memory);
    setOpen(false);
    setHighlightIndex(-1);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        setOpen(false);
        setHighlightIndex(-1);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      if (!canSearch) return;
      event.preventDefault();
      setOpen(true);
      setHighlightIndex((prev) => {
        if (suggestions.length === 0) return -1;
        return prev < suggestions.length - 1 ? prev + 1 : 0;
      });
      return;
    }

    if (event.key === 'ArrowUp') {
      if (!open || suggestions.length === 0) return;
      event.preventDefault();
      setHighlightIndex((prev) => {
        if (prev <= 0) return suggestions.length - 1;
        return prev - 1;
      });
      return;
    }

    if (event.key === 'Enter') {
      if (open && highlightIndex >= 0 && suggestions[highlightIndex]) {
        // Phase B: apply suggestion into fields; do not submit the form yet.
        event.preventDefault();
        applySuggestion(suggestions[highlightIndex]);
      }
      // else: let the form submit (add item)
    }
  }

  const activeDescendant =
    showList && highlightIndex >= 0
      ? `${listboxId}-opt-${highlightIndex}`
      : undefined;

  return (
    <div className="item-combobox" ref={containerRef}>
      <input
        id={id}
        ref={inputRef}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-activedescendant={activeDescendant}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlightIndex(-1);
        }}
        onFocus={() => {
          if (value.trim().length >= MIN_QUERY_LENGTH) {
            setOpen(true);
          }
        }}
        onKeyDown={onInputKeyDown}
        maxLength={maxLength}
        autoComplete="off"
        disabled={disabled}
      />

      {showList && (
        <ul
          id={listboxId}
          className="item-combobox-list"
          role="listbox"
          aria-label="Remembered items"
        >
          {searchQuery.isFetching && suggestions.length === 0 && (
            <li className="item-combobox-status" role="presentation">
              Searching…
            </li>
          )}
          {!searchQuery.isFetching &&
            searchQuery.isFetched &&
            suggestions.length === 0 && (
              <li className="item-combobox-status" role="presentation">
                No matches
              </li>
            )}
          {suggestions.map((memory, index) => {
            const selected = index === highlightIndex;
            return (
              <li
                key={memory.id}
                id={`${listboxId}-opt-${index}`}
                role="option"
                aria-selected={selected}
                className={
                  selected
                    ? 'item-combobox-option item-combobox-option-active'
                    : 'item-combobox-option'
                }
                onMouseEnter={() => setHighlightIndex(index)}
                onMouseDown={(e) => {
                  // Prevent input blur before click handler runs.
                  e.preventDefault();
                }}
                onClick={() => applySuggestion(memory)}
              >
                <span className="item-combobox-option-name">{memory.name}</span>
                <span className="item-combobox-option-category muted">
                  {memory.category.name}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
