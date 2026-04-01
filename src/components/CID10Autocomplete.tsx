'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface CID10SearchResult {
  code: string;
  name: string;
  label: string;
}

interface CID10AutocompleteProps {
  /** Currently selected CID codes as comma-separated string (e.g., "E11, I10") */
  value: string;
  /** Called when selection changes, with comma-separated string */
  onChange: (value: string) => void;
  /** Optional placeholder */
  placeholder?: string;
  /** Optional CSS class for the container */
  className?: string;
}

export default function CID10Autocomplete({
  value,
  onChange,
  placeholder = 'Buscar CID-10...',
  className = '',
}: CID10AutocompleteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CID10SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parse comma-separated value into array of selected codes
  const selectedCodes: string[] = value
    ? value
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : [];

  // Fetch search results with debounce
  const doSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/cid10/search?q=${encodeURIComponent(searchQuery)}&limit=15`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setIsOpen(true);
        setHighlightedIndex(-1);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        doSearch(val);
      }, 250);
    },
    [doSearch]
  );

  // Add a CID code to the selection
  const addCode = useCallback(
    (code: string) => {
      if (selectedCodes.includes(code)) return; // no duplicates

      const newCodes = [...selectedCodes, code];
      onChange(newCodes.join(', '));
      setQuery('');
      setResults([]);
      setIsOpen(false);
      inputRef.current?.focus();
    },
    [selectedCodes, onChange]
  );

  // Remove a CID code from the selection
  const removeCode = useCallback(
    (code: string) => {
      const newCodes = selectedCodes.filter((c) => c !== code);
      onChange(newCodes.join(', '));
    },
    [selectedCodes, onChange]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || results.length === 0) {
        // Backspace to remove last chip when input is empty
        if (e.key === 'Backspace' && query === '' && selectedCodes.length > 0) {
          removeCode(selectedCodes[selectedCodes.length - 1]);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < results.length) {
            addCode(results[highlightedIndex].code);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [isOpen, results, highlightedIndex, query, selectedCodes, addCode, removeCode]
  );

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Filter out already selected codes from results
  const filteredResults = results.filter((r) => !selectedCodes.includes(r.code));

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Selected chips + input */}
      <div
        className="flex min-h-[38px] flex-wrap items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 focus-within:ring-2 focus-within:ring-blue-200"
        onClick={() => inputRef.current?.focus()}
      >
        {selectedCodes.map((code) => (
          <span
            key={code}
            className="inline-flex items-center gap-0.5 rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
          >
            {code}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeCode(code);
              }}
              className="ml-0.5 rounded hover:bg-blue-200 focus:outline-none"
              aria-label={`Remover ${code}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.trim() && results.length > 0) setIsOpen(true);
          }}
          placeholder={selectedCodes.length === 0 ? placeholder : 'Adicionar CID...'}
          className="min-w-[120px] flex-1 border-none bg-transparent py-0.5 text-sm outline-none placeholder:text-slate-400"
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
        />
        {isLoading && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
        )}
      </div>

      {/* Dropdown */}
      {isOpen && filteredResults.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {filteredResults.map((result, index) => (
            <li
              key={result.code}
              role="option"
              aria-selected={index === highlightedIndex}
              className={`cursor-pointer px-3 py-2 text-sm transition-colors ${
                index === highlightedIndex
                  ? 'bg-blue-50 text-blue-900'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
              onClick={() => addCode(result.code)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <span className="font-semibold text-blue-700">{result.code}</span>
              <span className="ml-1.5 text-slate-600">— {result.name}</span>
            </li>
          ))}
        </ul>
      )}

      {/* No results */}
      {isOpen && query.trim() && filteredResults.length === 0 && !isLoading && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-center text-sm text-slate-500 shadow-lg">
          Nenhum CID encontrado para &quot;{query}&quot;
        </div>
      )}
    </div>
  );
}
