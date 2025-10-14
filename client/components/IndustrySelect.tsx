import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface IndustrySelectProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  baseOptions?: string[];
}

export function IndustrySelect({ value, onChange, placeholder, baseOptions = [] }: IndustrySelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [newIndustry, setNewIndustry] = React.useState('');
  const [options, setOptions] = React.useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('client:industries');
      const saved = raw ? JSON.parse(raw) : [];
      const base = Array.isArray(saved) ? saved : [];
      const merged = Array.from(new Set<string>([...base, ...baseOptions]));
      return merged.length ? merged : baseOptions;
    } catch {
      return [...baseOptions];
    }
  });

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/industries');
        if (res.ok) {
          const data = await res.json();
          const serverList: string[] = Array.isArray(data) ? data.map((i: any) => i.name || i) : [];
          setOptions(prev => {
            const merged = Array.from(new Set<string>([...prev, ...serverList]));
            try { localStorage.setItem('client:industries', JSON.stringify(merged)); } catch {}
            return merged;
          });
        }
      } catch {}
    })();
  }, []);

  React.useEffect(() => {
    try { localStorage.setItem('client:industries', JSON.stringify(options)); } catch {}
  }, [options]);

  const items = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.toLowerCase().includes(q));
  }, [options, query]);

  const addNew = async () => {
    const name = newIndustry.trim();
    if (!name) return;
    if (!options.some(o => o.toLowerCase() === name.toLowerCase())) {
      const next = [...options, name];
      setOptions(next);
    }
    onChange(name);
    setNewIndustry('');
    setOpen(false);
    try {
      await fetch('/api/industries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description: '', departments: [] }) });
    } catch {}
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span className="truncate">{value || placeholder || 'Select industry'}</span>
          <span className="ml-2 text-xs text-muted-foreground">Select</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[80] w-72 p-0">
        <Command>
          <CommandInput placeholder="Search industry..." value={query} onValueChange={(v) => setQuery(v || '')} />
          <CommandEmpty>No industry found.</CommandEmpty>
          <CommandList className="max-h-60 overflow-y-auto">
            <CommandGroup>
              {items.map(ind => (
                <CommandItem key={ind} value={ind} onSelect={() => { onChange(ind); setOpen(false); setQuery(''); }}>
                  {ind}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="border-t p-2">
          <div className="flex gap-2">
            <Input
              placeholder="Add new industry"
              value={newIndustry}
              onChange={(e) => setNewIndustry(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addNew(); }}
            />
            <Button size="sm" onClick={addNew}>Add</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default IndustrySelect;
