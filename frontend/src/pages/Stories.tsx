import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink, X, CheckCircle, Plus } from 'lucide-react';
import { User } from '../hooks/useAuth';
import { SearchBar } from '../components/SearchBar';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { TagInput } from '../components/TagInput';

interface Story {
  id: number;
  title: string;
  customer_name: string;
  summary: string;
  challenge: string;
  outcome: string;
  databricks_products: string;
  salesforce_opportunity_url: string;
  salesforce_account_url: string;
  is_referenceable: boolean;
  tags: string[];
  status: string;
  created_by: string;
  created_at: string;
  links?: { entity_type: string; entity_id: number }[];
}

interface StoriesProps {
  user: User | null;
}

export function Stories({ user }: StoriesProps) {
  const [searchParams] = useSearchParams();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selected, setSelected] = useState<Story | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', customer_name: '', summary: '', challenge: '', outcome: '', databricks_products: '', salesforce_opportunity_url: '', salesforce_account_url: '', is_referenceable: false, tags: [] as string[] });
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState('');

  const initialId = searchParams.get('id');
  useEffect(() => {
    if (initialId && stories.length > 0) {
      const found = stories.find((s) => s.id === Number(initialId));
      if (found) openDetail(found.id);
    }
  }, [initialId, stories]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);

    fetch(`/api/stories?${params}`)
      .then((r) => r.json())
      .then(setStories)
      .catch(() => setStories([]))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    fetch('/api/tools/tags').then((r) => r.json()).then((d) => setAllTags(d.tags || [])).catch(() => {});
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSaving(true); setCreateError('');
    try {
      const res = await fetch('/api/stories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createForm) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || 'Failed'); }
      const created: Story = await res.json();
      setStories((prev) => [created, ...prev]);
      setCreating(false);
      setCreateForm({ title: '', customer_name: '', summary: '', challenge: '', outcome: '', databricks_products: '', salesforce_opportunity_url: '', salesforce_account_url: '', is_referenceable: false, tags: [] });
      openDetail(created.id);
    } catch (err: unknown) { setCreateError(err instanceof Error ? err.message : 'Failed'); }
    finally { setCreateSaving(false); }
  };

  const openDetail = (id: number) => {
    setDetailLoading(true);
    fetch(`/api/stories/${id}`)
      .then((r) => r.json())
      .then(setSelected)
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  };

  const showStatus = user && (user.role === 'contributor' || user.role === 'admin');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-db-navy">Customer Stories</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-db-grey-mid">{stories.length} entries</span>
          {user && (user.role === 'contributor' || user.role === 'admin') && (
            <button onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-db-red text-white text-sm font-medium hover:bg-db-red-dark transition-colors">
              <Plus className="w-4 h-4" /> Add Story
            </button>
          )}
        </div>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Search stories..." className="max-w-sm" />

      {loading ? (
        <div className="text-center py-10 text-db-grey-mid text-sm">Loading...</div>
      ) : stories.length === 0 ? (
        <Card className="text-center py-10">
          <p className="text-db-grey-mid text-sm">No stories found.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stories.map((story) => (
            <Card key={story.id} hover onClick={() => openDetail(story.id)}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="font-semibold text-db-navy text-sm line-clamp-2">{story.title}</div>
                {story.is_referenceable && (
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" aria-label="Referenceable" />
                )}
              </div>
              <div className="text-xs text-db-blue font-medium mb-2">{story.customer_name}</div>
              <p className="text-xs text-gray-600 line-clamp-3 mb-3">{story.summary}</p>
              <div className="flex flex-wrap gap-1">
                {showStatus && <Badge variant="status">{story.status}</Badge>}
                {story.tags.slice(0, 2).map((t) => <Badge key={t} variant="tag">{t}</Badge>)}
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
              <h2 className="text-lg font-bold text-db-navy">Add Customer Story</h2>
              <button onClick={() => setCreating(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div><label className={lbl}>Title *</label><input required value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} className={inp} /></div>
              <div><label className={lbl}>Customer Name</label><input value={createForm.customer_name} onChange={(e) => setCreateForm({ ...createForm, customer_name: e.target.value })} className={inp} /></div>
              <div><label className={lbl}>Summary</label><textarea rows={3} value={createForm.summary} onChange={(e) => setCreateForm({ ...createForm, summary: e.target.value })} className={inp} /></div>
              <div><label className={lbl}>Challenge</label><textarea rows={2} value={createForm.challenge} onChange={(e) => setCreateForm({ ...createForm, challenge: e.target.value })} className={inp} /></div>
              <div><label className={lbl}>Outcome</label><textarea rows={2} value={createForm.outcome} onChange={(e) => setCreateForm({ ...createForm, outcome: e.target.value })} className={inp} /></div>
              <div><label className={lbl}>Databricks Products</label><input value={createForm.databricks_products} onChange={(e) => setCreateForm({ ...createForm, databricks_products: e.target.value })} className={inp} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>SF Opportunity URL</label><input type="url" value={createForm.salesforce_opportunity_url} onChange={(e) => setCreateForm({ ...createForm, salesforce_opportunity_url: e.target.value })} className={inp} /></div>
                <div><label className={lbl}>SF Account URL</label><input type="url" value={createForm.salesforce_account_url} onChange={(e) => setCreateForm({ ...createForm, salesforce_account_url: e.target.value })} className={inp} /></div>
              </div>
              <div><label className={lbl}>Tags</label><TagInput value={createForm.tags} onChange={(tags) => setCreateForm({ ...createForm, tags })} suggestions={allTags} /></div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={createForm.is_referenceable} onChange={(e) => setCreateForm({ ...createForm, is_referenceable: e.target.checked })} className="rounded border-gray-300" />
                Referenceable externally
              </label>
              {createError && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{createError}</div>}
              <button type="submit" disabled={createSaving} className="w-full bg-db-red text-white py-2.5 rounded-lg font-medium text-sm hover:bg-db-red-dark disabled:opacity-60 transition-colors">
                {createSaving ? 'Saving...' : 'Save as Draft'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {(selected || detailLoading) && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative bg-white w-full max-w-xl shadow-2xl overflow-y-auto flex flex-col">
            {detailLoading ? (
              <div className="text-center py-20 text-db-grey-mid text-sm">Loading...</div>
            ) : selected ? (
              <>
                {/* Navy header */}
                <div className="bg-db-navy px-6 pt-5 pb-6">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-bold text-white leading-tight">{selected.title}</h2>
                      {selected.customer_name && (
                        <div className="text-db-blue font-semibold text-sm mt-1">{selected.customer_name}</div>
                      )}
                    </div>
                    <button onClick={() => setSelected(null)} className="text-white/50 hover:text-white transition-colors mt-0.5 flex-shrink-0">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selected.is_referenceable && (
                      <span className="flex items-center gap-1.5 bg-green-500/20 text-green-300 text-xs px-2.5 py-1 rounded-full font-medium">
                        <CheckCircle className="w-3 h-3" /> Referenceable
                      </span>
                    )}
                    {showStatus && (
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${selected.status === 'published' ? 'bg-green-400/20 text-green-200' : 'bg-yellow-400/20 text-yellow-200'}`}>
                        {selected.status}
                      </span>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col gap-5">
                  {/* Summary — lead text */}
                  {selected.summary && (
                    <p className="text-gray-700 text-sm leading-relaxed italic border-l-4 border-db-blue/30 pl-4">
                      {selected.summary}
                    </p>
                  )}

                  {/* Challenge + Outcome — side by side cards */}
                  {(selected.challenge || selected.outcome) && (
                    <div className="grid grid-cols-2 gap-3">
                      {selected.challenge && (
                        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                          <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Challenge</div>
                          <p className="text-sm text-amber-900 leading-relaxed">{selected.challenge}</p>
                        </div>
                      )}
                      {selected.outcome && (
                        <div className="rounded-xl bg-green-50 border border-green-200 p-4">
                          <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Outcome</div>
                          <p className="text-sm text-green-900 leading-relaxed">{selected.outcome}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Databricks products — highlighted */}
                  {selected.databricks_products && (
                    <div className="rounded-xl bg-db-blue-light border border-db-blue/20 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded bg-db-blue flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">D</span>
                        </div>
                        <span className="text-xs font-semibold text-db-blue uppercase tracking-wide">Databricks Products</span>
                      </div>
                      <p className="text-sm text-db-navy">{selected.databricks_products}</p>
                    </div>
                  )}

                  {/* Salesforce links */}
                  {(selected.salesforce_opportunity_url || selected.salesforce_account_url) && (
                    <div>
                      <div className="text-xs font-semibold text-db-grey-mid uppercase tracking-wide mb-2">Salesforce</div>
                      <div className="flex flex-wrap gap-2">
                        {selected.salesforce_opportunity_url && (
                          <a href={selected.salesforce_opportunity_url} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-db-blue/30 text-db-blue text-sm font-medium hover:bg-db-blue-light transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" /> Opportunity
                          </a>
                        )}
                        {selected.salesforce_account_url && (
                          <a href={selected.salesforce_account_url} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-db-blue/30 text-db-blue text-sm font-medium hover:bg-db-blue-light transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" /> Account
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {selected.tags.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-db-grey-mid uppercase tracking-wide mb-2">Tags</div>
                      <div className="flex flex-wrap gap-1.5">
                        {selected.tags.map((t) => (
                          <span key={t} className="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full border border-gray-200">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-gray-400 pt-3 border-t border-gray-100">
                    Added by {selected.created_by} · {new Date(selected.created_at).toLocaleDateString()}
                  </div>
                </div>
              </>
            ) : null}
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
