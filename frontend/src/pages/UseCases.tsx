import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X, Plus } from 'lucide-react';
import { User } from '../hooks/useAuth';
import { SearchBar } from '../components/SearchBar';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { TagInput } from '../components/TagInput';

interface UseCase {
  id: number;
  name: string;
  category: string;
  problem_statement: string;
  databricks_solution: string;
  relevant_products: string;
  maturity: string;
  tags: string[];
  status: string;
  created_by: string;
  created_at: string;
}

const CATEGORIES = ['Asset Management', 'Grid Operations', 'Customer Analytics', 'Trading & Market', 'Compliance', 'Other'];
const MATURITY = ['Emerging', 'Growing', 'Established'];

interface UseCasesProps {
  user: User | null;
}

export function UseCases({ user }: UseCasesProps) {
  const [searchParams] = useSearchParams();
  const [useCases, setUseCases] = useState<UseCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState('');
  const [maturity, setMaturity] = useState('');
  const [selected, setSelected] = useState<UseCase | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', category: 'Other', problem_statement: '', databricks_solution: '', relevant_products: '', maturity: 'Emerging', tags: [] as string[] });
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState('');

  const initialId = searchParams.get('id');
  useEffect(() => {
    if (initialId && useCases.length > 0) {
      const found = useCases.find((u) => u.id === Number(initialId));
      if (found) setSelected(found);
    }
  }, [initialId, useCases]);

  useEffect(() => {
    fetch('/api/tools/tags').then((r) => r.json()).then((d) => setAllTags(d.tags || [])).catch(() => {});
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSaving(true); setCreateError('');
    try {
      const res = await fetch('/api/use-cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createForm) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || 'Failed'); }
      const created: UseCase = await res.json();
      setUseCases((prev) => [created, ...prev]);
      setCreating(false);
      setCreateForm({ name: '', category: 'Other', problem_statement: '', databricks_solution: '', relevant_products: '', maturity: 'Emerging', tags: [] });
      setSelected(created);
    } catch (err: unknown) { setCreateError(err instanceof Error ? err.message : 'Failed'); }
    finally { setCreateSaving(false); }
  };

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    if (maturity) params.set('maturity', maturity);

    fetch(`/api/use-cases?${params}`)
      .then((r) => r.json())
      .then(setUseCases)
      .catch(() => setUseCases([]))
      .finally(() => setLoading(false));
  }, [search, category, maturity]);

  const showStatus = user && (user.role === 'contributor' || user.role === 'admin');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-db-navy">Business Use Cases</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-db-grey-mid">{useCases.length} entries</span>
          {user && (user.role === 'contributor' || user.role === 'admin') && (
            <button onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-db-red text-white text-sm font-medium hover:bg-db-red-dark transition-colors">
              <Plus className="w-4 h-4" /> Add Use Case
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Search use cases..." className="flex-1" />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-db-blue/30"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={maturity}
          onChange={(e) => setMaturity(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-db-blue/30"
        >
          <option value="">All Maturity</option>
          {MATURITY.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-10 text-db-grey-mid text-sm">Loading...</div>
      ) : useCases.length === 0 ? (
        <Card className="text-center py-10">
          <p className="text-db-grey-mid text-sm">No use cases found.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {useCases.map((uc) => (
            <Card key={uc.id} hover onClick={() => setSelected(uc)}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="font-semibold text-db-navy text-sm">{uc.name}</div>
                <Badge variant="maturity">{uc.maturity}</Badge>
              </div>
              <Badge variant="category">{uc.category}</Badge>
              <p className="text-xs text-gray-600 line-clamp-3 mt-2 mb-3">{uc.problem_statement}</p>
              <div className="flex flex-wrap gap-1">
                {showStatus && <Badge variant="status">{uc.status}</Badge>}
                {uc.tags.slice(0, 2).map((t) => <Badge key={t} variant="tag">{t}</Badge>)}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create drawer */}
      {creating && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCreating(false)} />
          <div className="relative bg-white w-full max-w-lg shadow-2xl overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-db-navy">Add Use Case</h2>
              <button onClick={() => setCreating(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div><label className={lbl}>Name *</label><input required value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} className={inp} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Category</label>
                  <select value={createForm.category} onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })} className={inp}>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><label className={lbl}>Maturity</label>
                  <select value={createForm.maturity} onChange={(e) => setCreateForm({ ...createForm, maturity: e.target.value })} className={inp}>
                    {MATURITY.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div><label className={lbl}>Problem Statement</label><textarea rows={3} value={createForm.problem_statement} onChange={(e) => setCreateForm({ ...createForm, problem_statement: e.target.value })} className={inp} /></div>
              <div><label className={lbl}>Databricks Solution</label><textarea rows={3} value={createForm.databricks_solution} onChange={(e) => setCreateForm({ ...createForm, databricks_solution: e.target.value })} className={inp} /></div>
              <div><label className={lbl}>Relevant Products</label><input value={createForm.relevant_products} onChange={(e) => setCreateForm({ ...createForm, relevant_products: e.target.value })} placeholder="e.g. Delta Live Tables, MLflow" className={inp} /></div>
              <div><label className={lbl}>Tags</label><TagInput value={createForm.tags} onChange={(tags) => setCreateForm({ ...createForm, tags })} suggestions={allTags} /></div>
              {createError && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{createError}</div>}
              <button type="submit" disabled={createSaving} className="w-full bg-db-red text-white py-2.5 rounded-lg font-medium text-sm hover:bg-db-red-dark disabled:opacity-60 transition-colors">
                {createSaving ? 'Saving...' : 'Save as Draft'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative bg-white w-full max-w-lg shadow-2xl overflow-y-auto p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-bold text-db-navy">{selected.name}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="category">{selected.category}</Badge>
              <Badge variant="maturity">{selected.maturity}</Badge>
              {showStatus && <Badge variant="status">{selected.status}</Badge>}
            </div>

            <Section title="Problem Statement">{selected.problem_statement}</Section>
            <Section title="Databricks Solution">{selected.databricks_solution}</Section>

            {selected.relevant_products && (
              <div>
                <div className="text-xs font-semibold text-db-grey-mid uppercase tracking-wide mb-1">Relevant Products</div>
                <p className="text-sm text-db-blue">{selected.relevant_products}</p>
              </div>
            )}

            {selected.tags.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-db-grey-mid uppercase tracking-wide mb-2">Tags</div>
                <div className="flex flex-wrap gap-1">
                  {selected.tags.map((t) => <Badge key={t} variant="tag">{t}</Badge>)}
                </div>
              </div>
            )}

            <div className="text-xs text-gray-400 mt-auto pt-2 border-t">
              Added by {selected.created_by} · {new Date(selected.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl = 'block text-xs font-semibold text-db-grey-mid uppercase tracking-wide mb-1';
const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-db-blue/30 focus:border-db-blue';

function Section({ title, children }: { title: string; children: string }) {
  if (!children) return null;
  return (
    <div>
      <div className="text-xs font-semibold text-db-grey-mid uppercase tracking-wide mb-1">{title}</div>
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{children}</p>
    </div>
  );
}
