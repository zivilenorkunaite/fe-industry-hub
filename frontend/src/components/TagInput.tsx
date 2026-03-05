import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}

export function TagInput({ value, onChange, suggestions = [], placeholder = 'Add tag...' }: TagInputProps) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = suggestions.filter(
    (s) => s.toLowerCase().includes(input.toLowerCase()) && !value.includes(s)
  );

  const add = (tag: string) => {
    const t = tag.trim();
    if (t && !value.includes(t)) {
      onChange([...value, t]);
    }
    setInput('');
    setOpen(false);
  };

  const remove = (tag: string) => onChange(value.filter((v) => v !== tag));

  const handleKey = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      add(input);
    } else if (e.key === 'Backspace' && !input && value.length) {
      remove(value[value.length - 1]);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="min-h-[38px] flex flex-wrap gap-1.5 items-center border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus-within:ring-2 focus-within:ring-db-blue/30 focus-within:border-db-blue">
        {value.map((tag) => (
          <span key={tag} className="flex items-center gap-1 bg-db-blue-light text-db-blue text-xs px-2 py-0.5 rounded-full border border-db-blue/20">
            {tag}
            <button type="button" onClick={() => remove(tag)} className="hover:text-db-navy">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[100px] text-sm outline-none bg-transparent"
        />
      </div>

      {open && (filtered.length > 0 || (input.trim() && !value.includes(input.trim()))) && (
        <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {input.trim() && !value.includes(input.trim()) && !suggestions.includes(input.trim()) && (
            <button
              type="button"
              onMouseDown={() => add(input)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-db-blue-light flex items-center gap-2"
            >
              <span className="text-db-blue font-medium">Create</span>
              <span className="bg-db-blue-light text-db-blue text-xs px-2 py-0.5 rounded-full border border-db-blue/20">{input.trim()}</span>
            </button>
          )}
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={() => add(s)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
