import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ItemNameCombobox } from './ItemNameCombobox';
import type { ItemMemory } from '../api/itemMemories';
import * as itemMemoriesApi from '../api/itemMemories';

vi.mock('../api/itemMemories', () => ({
  searchItemMemories: vi.fn(),
}));

const milk: ItemMemory = {
  id: 'mem-1',
  name: 'Milk',
  nameKey: 'milk',
  categoryId: 'cat-dairy',
  useCount: 2,
  lastUsedAt: new Date().toISOString(),
  category: { id: 'cat-dairy', name: 'Dairy', sortOrder: 1 },
};

const bananas: ItemMemory = {
  id: 'mem-2',
  name: 'Bananas',
  nameKey: 'bananas',
  categoryId: 'cat-produce',
  useCount: 1,
  lastUsedAt: new Date().toISOString(),
  category: { id: 'cat-produce', name: 'Produce', sortOrder: 0 },
};

function renderAt(value: string, onPick = vi.fn(), onChange = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <ItemNameCombobox
        id="item-name"
        value={value}
        onChange={onChange}
        onPick={onPick}
      />
    </QueryClientProvider>
  );

  return { ...view, onPick, onChange, queryClient };
}

describe('ItemNameCombobox', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(itemMemoriesApi.searchItemMemories).mockResolvedValue({
      itemMemories: [milk, bananas],
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not search until at least one character is typed', () => {
    renderAt('');
    expect(itemMemoriesApi.searchItemMemories).not.toHaveBeenCalled();
  });

  it('searches after debounce and shows matches', async () => {
    renderAt('mi');
    fireEvent.focus(screen.getByRole('combobox'));

    await vi.advanceTimersByTimeAsync(220);

    await waitFor(() => {
      expect(itemMemoriesApi.searchItemMemories).toHaveBeenCalledWith('mi');
    });

    expect(
      await screen.findByRole('option', { name: /Milk/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Dairy')).toBeInTheDocument();
  });

  it('calls onPick when a suggestion is clicked', async () => {
    const onPick = vi.fn();
    renderAt('ba', onPick);
    fireEvent.focus(screen.getByRole('combobox'));

    await vi.advanceTimersByTimeAsync(220);
    const option = await screen.findByRole('option', { name: /Bananas/i });
    fireEvent.click(option);

    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Bananas', categoryId: 'cat-produce' })
    );
  });

  it('applies highlighted suggestion on Enter without submitting the form', async () => {
    const onPick = vi.fn();
    const onFormSubmit = vi.fn((e: Event) => e.preventDefault());
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <form onSubmit={onFormSubmit}>
        <QueryClientProvider client={queryClient}>
          <ItemNameCombobox
            id="item-name"
            value="mi"
            onChange={() => undefined}
            onPick={onPick}
          />
        </QueryClientProvider>
      </form>
    );

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    await vi.advanceTimersByTimeAsync(220);
    await screen.findByRole('option', { name: /Milk/i });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Milk' })
    );
    expect(onFormSubmit).not.toHaveBeenCalled();
  });
});
