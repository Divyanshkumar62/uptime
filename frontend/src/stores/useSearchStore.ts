import { create } from 'zustand';

interface SearchState {
  query: string;
  setQuery: (query: string) => void;
  selectedTags: string[];
  toggleTag: (tag: string) => void;
  setSelectedTags: (tags: string[]) => void;
  clearTags: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  setQuery: (query) => set({ query }),
  selectedTags: [],
  toggleTag: (tag) =>
    set((state) => {
      const normalized = tag.trim().toLowerCase();
      const currentNormalized = state.selectedTags.map((t) => t.trim().toLowerCase());
      const hasTag = currentNormalized.includes(normalized);
      const newTags = hasTag
        ? currentNormalized.filter((t) => t !== normalized)
        : [...currentNormalized, normalized];
      return { selectedTags: Array.from(new Set(newTags)) };
    }),
  setSelectedTags: (selectedTags) =>
    set({
      selectedTags: Array.from(
        new Set(selectedTags.map((t) => t.trim().toLowerCase()))
      ),
    }),
  clearTags: () => set({ selectedTags: [] }),
}));
