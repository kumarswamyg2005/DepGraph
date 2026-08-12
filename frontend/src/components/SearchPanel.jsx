import React, { useState, useRef, useEffect } from 'react';
import { searchPackages, searchDevelopers } from '../lib/api';

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/**
 * SearchPanel — typeahead search for packages or developers
 * Props:
 *   mode: 'package' | 'developer'
 *   onSelect: (item) => void
 *   placeholder: string
 *   value: string
 *   onChange: (val) => void
 */
export function SearchPanel({ mode = 'package', onSelect, placeholder, value, onChange, onSubmit }) {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounce(value, 280);
  const containerRef = useRef();

  useEffect(() => {
    if (!debounced || debounced.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    let active = true;
    setLoading(true);
    const fn = mode === 'package' ? searchPackages : searchDevelopers;
    fn(debounced).then(({ data }) => {
      if (!active) return;
      setResults(Array.isArray(data) ? data : []);
      setOpen(true);
      setLoading(false);
    });
    return () => { active = false; };
  }, [debounced, mode]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function select(item) {
    const label = mode === 'package' ? (item.p?.name || item.name) : (item.d?.username || item.username);
    onChange(label);
    if (onSelect) onSelect(item);
    setOpen(false);
    setResults([]);
    if (onSubmit) onSubmit(label);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          id={`search-${mode}`}
          className="input pr-8"
          placeholder={placeholder || (mode === 'package' ? 'Search packages...' : 'Search developers...')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setOpen(false);
              if (onSubmit) onSubmit(value);
            }
          }}
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-3 h-3 border border-text-dim border-t-text-muted rounded-full animate-spin" />
          </div>
        )}
      </div>


      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 panel shadow-2xl overflow-auto max-h-60">
          {results.map((item, i) => {
            const pkg = item.p || item;
            const dev = item.d || item;
            if (mode === 'package') {
              return (
                <div
                  key={i}
                  className="px-3 py-2 cursor-pointer hover:bg-bg-subtle flex items-center justify-between gap-3"
                  onMouseDown={() => select(item)}
                >
                  <span className="font-mono text-sm text-text-primary truncate">{pkg.name}</span>
                  <span className={`badge ${pkg.ecosystem === 'npm' ? 'badge-npm' : 'badge-pypi'}`}>
                    {pkg.ecosystem}
                  </span>
                </div>
              );
            }
            return (
              <div
                key={i}
                className="px-3 py-2 cursor-pointer hover:bg-bg-subtle flex items-center gap-3"
                onMouseDown={() => select(item)}
              >
                <span className="font-mono text-sm text-text-primary truncate">{dev.username}</span>
                <span className="text-text-dim text-xs truncate">{dev.name}</span>
              </div>
            );
          })}
        </div>
      )}

      {open && debounced.length >= 2 && !loading && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 panel px-3 py-3 text-xs text-text-dim font-mono">
          No {mode}s found for "{debounced}"
        </div>
      )}
    </div>
  );
}
