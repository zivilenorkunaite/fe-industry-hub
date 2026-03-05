import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface ComboBoxProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}

export function ComboBox({ value, onChange, options, placeholder = 'Select or type...', className = '' }: ComboBoxProps) {
  const [input, setInput] = useState(value);
  const [filterText, setFilterText] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setInput(value); }, [value]);

  // Filter only when user has typed something; otherwise show all options
  const filtered = filterText
    ? options.filter((o) => o.toLowerCase().includes(filterText.toLowerCase()))
    : options;

  const select = (opt: string) => {
    onChange(opt);
    setInput(opt);
    setFilterText('');
    setOpen(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    setFilterText(e.target.value);
    onChange(e.target.value);
    setOpen(true);
  };

  const handleFocus = () => {
    setFilterText(''); // Show full list on open
    setOpen(true);
  };

  const handleBlur = () => {
    if (input.trim()) onChange(input.trim());
    setTimeout(() => { setOpen(false); setFilterText(''); }, 150);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setFilterText('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showCreate = filterText.trim() && !options.includes(filterText.trim());

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-db-blue/30 focus:border-db-blue"
        />
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>

      {open && (filtered.length > 0 || showCreate) && (
        <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {showCreate && (
            <button
              type="button"
              onMouseDown={() => select(filterText.trim())}
              className="w-full text-left px-3 py-2 text-sm hover:bg-db-blue-light flex items-center gap-2"
            >
              <span className="text-db-blue font-medium">Create</span>
              <span className="text-db-grey-dark">"{filterText.trim()}"</span>
            </button>
          )}
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              onMouseDown={() => select(opt)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${opt === value ? 'font-medium text-db-blue' : ''}`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
