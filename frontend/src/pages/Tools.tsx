import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink, X, Pencil, Save, Loader2, Sparkles, Plus, Building2, Trash2, Check } from 'lucide-react';
import { User } from '../hooks/useAuth';
import { SearchBar } from '../components/SearchBar';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { ComboBox } from '../components/ComboBox';
import { TagInput } from '../components/TagInput';

interface Tool {
  id: number;
  name: string;
  vendor: string;
  category: string;
  description: string;
  databricks_integration: string;
  integration_type: string;
  website_url: string;
  tags: string[];
  status: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
  customer_count?: number;
  live_count?: number;
  implementing_count?: number;
  identified_count?: number;
  customer_names?: string[];
}

const INTEGRATION_TYPES = ['Direct Connector', 'Partner', 'Custom ETL', 'API'];
const CUSTOMER_STAGES = ['Identified', 'Implementing', 'Live'];

interface ToolCustomer {
  id: number;
  tool_id: number;
  customer_name: string;
  stage: string;
  notes: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

interface ToolsProps {
  user: User | null;
}

export function Tools({ user }: ToolsProps) {
  const [searchParams] = useSearchParams();
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selected, setSelected] = useState<Tool | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Tool | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [generating, setGenerating] = useState(false);

  // Customer state
  const [customers, setCustomers] = useState<ToolCustomer[]>([]);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState({ customer_name: '', stage: 'Identified', notes: '' });
  const [editingCustomer, setEditingCustomer] = useState<ToolCustomer | null>(null);
  const [customerSaving, setCustomerSaving] = useState(false);

  // Create state
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', vendor: '', category: 'Other', description: '', databricks_integration: '', integration_type: 'Custom ETL', website_url: '', tags: [] as string[] });
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createGenerating, setCreateGenerating] = useState(false);

  const initialId = searchParams.get('id');
  useEffect(() => {
    if (initialId && tools.length > 0) {
      const found = tools.find((t) => t.id === Number(initialId));
      if (found) openTool(found);
    }
  }, [initialId, tools]);

  useEffect(() => {
    fetch('/api/tools/categories').then((r) => r.json()).then((d) => setCategories(d.categories || [])).catch(() => {});
    fetch('/api/tools/tags').then((r) => r.json()).then((d) => setAllTags(d.tags || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    fetch(`/api/tools?${params}`)
      .then((r) => r.json())
      .then(setTools)
      .catch(() => setTools([]))
      .finally(() => setLoading(false));
  }, [search, category]);

  const openTool = (tool: Tool) => {
    setSelected(tool);
    setEditing(false);
    setEditForm(null);
    setSaveError('');
    setAddingCustomer(false);
    setEditingCustomer(null);
    setCustomerForm({ customer_name: '', stage: 'Identified', notes: '' });
    fetch(`/api/tools/${tool.id}/customers`).then((r) => r.json()).then(setCustomers).catch(() => setCustomers([]));
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !customerForm.customer_name.trim()) return;
    setCustomerSaving(true);
    try {
      const res = await fetch(`/api/tools/${selected.id}/customers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerForm),
      });
      if (!res.ok) throw new Error('Failed');
      const created: ToolCustomer = await res.json();
      setCustomers((prev) => [...prev, created]);
      setAddingCustomer(false);
      setCustomerForm({ customer_name: '', stage: 'Identified', notes: '' });
    } finally { setCustomerSaving(false); }
  };

  const handleUpdateCustomer = async (customer: ToolCustomer, updates: Partial<ToolCustomer>) => {
    if (!selected) return;
    const res = await fetch(`/api/tools/${selected.id}/customers/${customer.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated: ToolCustomer = await res.json();
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditingCustomer(null);
    }
  };

  const handleDeleteCustomer = async (customer: ToolCustomer) => {
    if (!selected) return;
    await fetch(`/api/tools/${selected.id}/customers/${customer.id}`, { method: 'DELETE' });
    setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
  };

  const startEdit = () => {
    setEditForm({ ...selected! });
    setEditing(true);
    setSaveError('');
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditForm(null);
    setSaveError('');
  };

  const handleSave = async () => {
    if (!editForm) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(`/api/tools/${editForm.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          vendor: editForm.vendor,
          category: editForm.category,
          description: editForm.description,
          databricks_integration: editForm.databricks_integration,
          integration_type: editForm.integration_type,
          website_url: editForm.website_url,
          tags: editForm.tags,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || 'Save failed');
      }
      const updated: Tool = await res.json();
      // PATCH response lacks customer summary fields — preserve them from the existing list entry
      const withCustomers = (prev: Tool): Tool => ({
        ...updated,
        customer_count: prev.customer_count,
        live_count: prev.live_count,
        implementing_count: prev.implementing_count,
        identified_count: prev.identified_count,
        customer_names: prev.customer_names,
      });
      setTools((prev) => prev.map((t) => (t.id === updated.id ? withCustomers(t) : t)));
      setSelected((prev) => prev ? withCustomers(prev) : updated);
      setEditing(false);
      setEditForm(null);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!editForm?.name.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/generate/tool-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editForm.name, vendor: editForm.vendor }),
      });
      if (!res.ok) throw new Error('Generation failed');
      const data = await res.json();
      setEditForm((f) => f ? {
        ...f,
        description: data.description || f.description,
        databricks_integration: data.databricks_integration || f.databricks_integration,
        tags: data.tags?.length ? [...new Set([...f.tags, ...data.tags])] : f.tags,
      } : f);
    } catch {
      setSaveError('AI generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSaving(true);
    setCreateError('');
    try {
      const res = await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || 'Failed'); }
      const created: Tool = await res.json();
      setTools((prev) => [created, ...prev]);
      setCreating(false);
      setCreateForm({ name: '', vendor: '', category: 'Other', description: '', databricks_integration: '', integration_type: 'Custom ETL', website_url: '', tags: [] });
      openTool(created);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setCreateSaving(false);
    }
  };

  const handleCreateGenerate = async () => {
    if (!createForm.name.trim()) return;
    setCreateGenerating(true);
    try {
      const res = await fetch('/api/generate/tool-description', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createForm.name, vendor: createForm.vendor }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCreateForm((f) => ({
        ...f,
        description: data.description || f.description,
        databricks_integration: data.databricks_integration || f.databricks_integration,
        tags: data.tags?.length ? [...new Set([...f.tags, ...data.tags])] : f.tags,
      }));
    } catch { setCreateError('AI generation failed'); }
    finally { setCreateGenerating(false); }
  };

  const canEdit = (tool: Tool) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'contributor') return tool.created_by === user.email && tool.status === 'draft';
    return false;
  };

  const showStatus = user && (user.role === 'contributor' || user.role === 'admin');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-db-navy">Tools &amp; Systems</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-db-grey-mid">{tools.length} entries</span>
          {user && (user.role === 'contributor' || user.role === 'admin') && (
            <button onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-db-red text-white text-sm font-medium hover:bg-db-red-dark transition-colors">
              <Plus className="w-4 h-4" /> Add Tool
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Search tools..." className="flex-1" />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-db-blue/30"
        >
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-10 text-db-grey-mid text-sm">Loading...</div>
      ) : tools.length === 0 ? (
        <Card className="text-center py-10">
          <p className="text-db-grey-mid text-sm">No tools found.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool) => (
            <Card key={tool.id} hover onClick={() => openTool(tool)}>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="min-w-0">
                  <div className="font-semibold text-db-navy text-sm leading-tight">{tool.name}</div>
                  {tool.vendor && <div className="text-xs text-db-grey-mid mt-0.5">{tool.vendor}</div>}
                </div>
                <Badge variant="category">{tool.category}</Badge>
              </div>

              <p className="text-xs text-gray-600 line-clamp-2 mb-2">{tool.description}</p>

              {/* Customer adoption */}
              {(tool.customer_count ?? 0) > 0 ? (
                <div className="mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    {(tool.live_count ?? 0) > 0 && (
                      <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                        {tool.live_count} Live
                      </span>
                    )}
                    {(tool.implementing_count ?? 0) > 0 && (
                      <span className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                        {tool.implementing_count} Implementing
                      </span>
                    )}
                    {(tool.identified_count ?? 0) > 0 && (
                      <span className="flex items-center gap-1 text-xs text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded-full border border-gray-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
                        {tool.identified_count} Identified
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {tool.customer_names?.slice(0, 3).join(', ')}
                    {(tool.customer_names?.length ?? 0) > 3 && ` +${(tool.customer_names?.length ?? 0) - 3} more`}
                  </div>
                </div>
              ) : (
                <div className="mb-2 text-xs text-gray-300 italic">No customers tracked</div>
              )}

              <div className="flex flex-wrap gap-1 pt-1.5 border-t border-gray-50">
                <Badge variant="tag">{tool.integration_type}</Badge>
                {showStatus && <Badge variant="status">{tool.status}</Badge>}
                {tool.tags.slice(0, 2).map((t) => <Badge key={t} variant="tag">{t}</Badge>)}
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
              <h2 className="text-lg font-bold text-db-navy">Add Tool</h2>
              <button onClick={() => setCreating(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Tool Name *</label><input required value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Vendor</label><input value={createForm.vendor} onChange={(e) => setCreateForm({ ...createForm, vendor: e.target.value })} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Category</label><ComboBox value={createForm.category} onChange={(v) => setCreateForm({ ...createForm, category: v })} options={categories} /></div>
                <div><label className={labelCls}>Integration Type</label>
                  <select value={createForm.integration_type} onChange={(e) => setCreateForm({ ...createForm, integration_type: e.target.value })} className={inputCls}>
                    {INTEGRATION_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={labelCls}>Description</label>
                  <button type="button" onClick={handleCreateGenerate} disabled={createGenerating || !createForm.name.trim()}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-db-navy text-white text-xs hover:bg-db-navy-light disabled:opacity-50 transition-colors">
                    {createGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {createGenerating ? 'Generating...' : 'Generate with AI'}
                  </button>
                </div>
                <textarea rows={4} value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} className={inputCls} />
              </div>
              <div><label className={labelCls}>Databricks Integration</label><textarea rows={3} value={createForm.databricks_integration} onChange={(e) => setCreateForm({ ...createForm, databricks_integration: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Website URL</label><input type="url" value={createForm.website_url} onChange={(e) => setCreateForm({ ...createForm, website_url: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Tags</label><TagInput value={createForm.tags} onChange={(tags) => setCreateForm({ ...createForm, tags })} suggestions={allTags} /></div>
              {createError && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{createError}</div>}
              <button type="submit" disabled={createSaving}
                className="w-full bg-db-red text-white py-2.5 rounded-lg font-medium text-sm hover:bg-db-red-dark disabled:opacity-60 transition-colors">
                {createSaving ? 'Saving...' : 'Save as Draft'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Detail / Edit drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setSelected(null); setEditing(false); }} />
          <div className="relative bg-white w-full max-w-xl shadow-2xl overflow-y-auto flex flex-col">

            {editing && editForm ? (
              /* ── EDIT MODE ── */
              <div className="p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-db-navy">Edit Tool</h2>
                  <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Name</label><input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={inputCls} /></div>
                  <div><label className={labelCls}>Vendor</label><input value={editForm.vendor} onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })} className={inputCls} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Category</label><ComboBox value={editForm.category} onChange={(v) => setEditForm({ ...editForm, category: v })} options={categories} /></div>
                  <div><label className={labelCls}>Integration Type</label>
                    <select value={editForm.integration_type} onChange={(e) => setEditForm({ ...editForm, integration_type: e.target.value })} className={inputCls}>
                      {INTEGRATION_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={labelCls}>Description</label>
                    <button type="button" onClick={handleGenerate} disabled={generating}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-db-navy text-white text-xs hover:bg-db-navy-light disabled:opacity-50 transition-colors">
                      {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      {generating ? 'Generating...' : 'Generate with AI'}
                    </button>
                  </div>
                  <textarea rows={4} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className={inputCls} />
                </div>
                <div><label className={labelCls}>Databricks Integration</label><textarea rows={3} value={editForm.databricks_integration} onChange={(e) => setEditForm({ ...editForm, databricks_integration: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Website URL</label><input type="url" value={editForm.website_url} onChange={(e) => setEditForm({ ...editForm, website_url: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Tags</label><TagInput value={editForm.tags} onChange={(tags) => setEditForm({ ...editForm, tags })} suggestions={allTags} /></div>
                {saveError && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{saveError}</div>}
                <div className="flex gap-2">
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-db-red text-white text-sm font-medium hover:bg-db-red-dark disabled:opacity-60 transition-colors">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button onClick={cancelEdit} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-db-grey-mid hover:border-gray-400 transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              /* ── VIEW MODE ── */
              <>
                {/* Navy header */}
                <div className="bg-db-navy px-6 pt-5 pb-6">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-bold text-white leading-tight">{selected.name}</h2>
                      {selected.vendor && (
                        <div className="text-white/60 text-sm mt-0.5">{selected.vendor}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                      {canEdit(selected) && (
                        <button onClick={startEdit}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 text-white text-xs font-medium hover:bg-white/25 transition-colors">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                      )}
                      <button onClick={() => setSelected(null)} className="text-white/50 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="bg-white/15 text-white text-xs px-2.5 py-1 rounded-full">{selected.category}</span>
                    <span className="bg-white/10 text-white/80 text-xs px-2.5 py-1 rounded-full">{selected.integration_type}</span>
                    {showStatus && (
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${selected.status === 'published' ? 'bg-green-400/20 text-green-200' : 'bg-yellow-400/20 text-yellow-200'}`}>
                        {selected.status}
                      </span>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col gap-5">
                  {/* Description */}
                  {selected.description && (
                    <div>
                      <div className={sectionLabel}>About</div>
                      <p className="text-gray-700 text-sm leading-relaxed">{selected.description}</p>
                    </div>
                  )}

                  {/* Databricks integration — highlighted */}
                  {selected.databricks_integration && (
                    <div className="rounded-xl bg-db-blue-light border border-db-blue/20 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded bg-db-blue flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">D</span>
                        </div>
                        <span className="text-xs font-semibold text-db-blue uppercase tracking-wide">Databricks Integration</span>
                      </div>
                      <p className="text-sm text-db-navy leading-relaxed">{selected.databricks_integration}</p>
                    </div>
                  )}

                  {/* Tags */}
                  {selected.tags.length > 0 && (
                    <div>
                      <div className={sectionLabel}>Tags</div>
                      <div className="flex flex-wrap gap-1.5">
                        {selected.tags.map((t) => (
                          <span key={t} className="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full border border-gray-200">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Customers */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className={sectionLabel}>Customers Using This Tool</div>
                      {user && (user.role === 'contributor' || user.role === 'admin') && !addingCustomer && (
                        <button onClick={() => setAddingCustomer(true)}
                          className="flex items-center gap-1 text-xs text-db-blue hover:text-db-navy transition-colors">
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                      )}
                    </div>

                    {addingCustomer && (
                      <form onSubmit={handleAddCustomer} className="mb-3 rounded-xl border border-db-blue/20 bg-db-blue-light p-3 space-y-2">
                        <input required placeholder="Customer name" value={customerForm.customer_name}
                          onChange={(e) => setCustomerForm({ ...customerForm, customer_name: e.target.value })}
                          className={inputCls} />
                        <div className="grid grid-cols-2 gap-2">
                          <select value={customerForm.stage} onChange={(e) => setCustomerForm({ ...customerForm, stage: e.target.value })} className={inputCls}>
                            {CUSTOMER_STAGES.map((s) => <option key={s}>{s}</option>)}
                          </select>
                          <input placeholder="Notes (optional)" value={customerForm.notes}
                            onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                            className={inputCls} />
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" disabled={customerSaving}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-db-blue text-white text-xs font-medium hover:opacity-90 disabled:opacity-60">
                            <Check className="w-3 h-3" /> Save
                          </button>
                          <button type="button" onClick={() => setAddingCustomer(false)}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:border-gray-400">
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}

                    {customers.length === 0 && !addingCustomer ? (
                      <p className="text-xs text-gray-400 italic">No customers tracked yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {customers.map((c) => (
                          <div key={c.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                            {editingCustomer?.id === c.id ? (
                              <div className="space-y-2">
                                <input value={editingCustomer.customer_name}
                                  onChange={(e) => setEditingCustomer({ ...editingCustomer, customer_name: e.target.value })}
                                  className={inputCls} />
                                <div className="grid grid-cols-2 gap-2">
                                  <select value={editingCustomer.stage}
                                    onChange={(e) => setEditingCustomer({ ...editingCustomer, stage: e.target.value })}
                                    className={inputCls}>
                                    {CUSTOMER_STAGES.map((s) => <option key={s}>{s}</option>)}
                                  </select>
                                  <input placeholder="Notes" value={editingCustomer.notes}
                                    onChange={(e) => setEditingCustomer({ ...editingCustomer, notes: e.target.value })}
                                    className={inputCls} />
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => handleUpdateCustomer(c, { customer_name: editingCustomer.customer_name, stage: editingCustomer.stage, notes: editingCustomer.notes })}
                                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-db-blue text-white text-xs font-medium">
                                    <Check className="w-3 h-3" /> Save
                                  </button>
                                  <button onClick={() => setEditingCustomer(null)}
                                    className="px-3 py-1 rounded-lg border border-gray-200 text-xs text-gray-500">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                  <Building2 className="w-3.5 h-3.5 text-db-grey-mid mt-0.5 flex-shrink-0" />
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-db-navy">{c.customer_name}</div>
                                    {c.notes && <div className="text-xs text-gray-500 truncate">{c.notes}</div>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageColor(c.stage)}`}>{c.stage}</span>
                                  {user && (user.role === 'contributor' || user.role === 'admin') && (
                                    <>
                                      <button onClick={() => setEditingCustomer({ ...c })} className="text-gray-400 hover:text-db-navy transition-colors">
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button onClick={() => handleDeleteCustomer(c)} className="text-gray-400 hover:text-red-500 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Website */}
                  {selected.website_url && (
                    <div>
                      <div className={sectionLabel}>Resources</div>
                      <a href={selected.website_url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-db-blue/30 text-db-blue text-sm font-medium hover:bg-db-blue-light transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" /> Visit Website
                      </a>
                    </div>
                  )}

                  <div className="text-xs text-gray-400 pt-3 border-t border-gray-100">
                    Added by {selected.created_by} · {new Date(selected.created_at).toLocaleDateString()}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-db-blue/30 focus:border-db-blue';
const labelCls = 'block text-xs font-semibold text-db-grey-mid uppercase tracking-wide mb-1';
const sectionLabel = 'text-xs font-semibold text-db-grey-mid uppercase tracking-wide mb-2';

function stageColor(stage: string): string {
  switch (stage) {
    case 'Live': return 'bg-green-100 text-green-700';
    case 'Implementing': return 'bg-blue-100 text-blue-700';
    case 'Identified': return 'bg-gray-100 text-gray-600';
    default: return 'bg-gray-100 text-gray-600';
  }
}
