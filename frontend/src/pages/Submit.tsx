import { useState, useEffect } from 'react';
import { CheckCircle, Sparkles, Loader2 } from 'lucide-react';
import { User } from '../hooks/useAuth';
import { Card } from '../components/Card';
import { ComboBox } from '../components/ComboBox';
import { TagInput } from '../components/TagInput';

type ContentType = 'tool' | 'story';

interface SubmitProps {
  user: User;
}

const DEFAULT_TOOL_CATEGORIES = ['OT System', 'Billing', 'AMI/MDM', 'GIS', 'Market Data', 'Data Platform', 'Other'];
const INTEGRATION_TYPES = ['Direct Connector', 'Partner', 'Custom ETL', 'API'];

export function Submit({ user }: SubmitProps) {
  const [type, setType] = useState<ContentType>('tool');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Dynamic category + tag lists fetched from DB
  const [toolCategories, setToolCategories] = useState<string[]>(DEFAULT_TOOL_CATEGORIES);
  const [allTags, setAllTags] = useState<string[]>([]);

  // Tool form state
  const [toolForm, setToolForm] = useState({
    name: '',
    vendor: '',
    category: 'Other',
    description: '',
    databricks_integration: '',
    integration_type: 'Custom ETL',
    website_url: '',
    tags: [] as string[],
  });
  const [generating, setGenerating] = useState(false);

  // Story form state
  const [storyForm, setStoryForm] = useState({
    title: '', customer_name: '', summary: '', challenge: '', outcome: '',
    databricks_products: '', salesforce_opportunity_url: '', salesforce_account_url: '',
    is_referenceable: false, tags: [] as string[],
  });

  useEffect(() => {
    fetch('/api/tools/categories').then((r) => r.json()).then((d) => {
      if (d.categories) setToolCategories(d.categories);
    }).catch(() => {});
    fetch('/api/tools/tags').then((r) => r.json()).then((d) => {
      if (d.tags) setAllTags(d.tags);
    }).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!toolForm.name.trim()) {
      setError('Enter a tool name first');
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/generate/tool-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: toolForm.name, vendor: toolForm.vendor }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || 'Generation failed');
      }
      const data = await res.json();
      setToolForm((f) => ({
        ...f,
        description: data.description || f.description,
        databricks_integration: data.databricks_integration || f.databricks_integration,
        tags: data.tags?.length ? [...new Set([...f.tags, ...data.tags])] : f.tags,
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      let url = '';
      let body: Record<string, unknown> = {};
      if (type === 'tool') {
        url = '/api/tools';
        body = { ...toolForm };
      } else {
        url = '/api/stories';
        body = { ...storyForm };
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || 'Submission failed');
      }
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSuccess(false);
    setToolForm({ name: '', vendor: '', category: 'Other', description: '', databricks_integration: '', integration_type: 'Custom ETL', website_url: '', tags: [] });
    setStoryForm({ title: '', customer_name: '', summary: '', challenge: '', outcome: '', databricks_products: '', salesforce_opportunity_url: '', salesforce_account_url: '', is_referenceable: false, tags: [] });
    setError('');
  };

  if (success) {
    return (
      <Card className="max-w-lg mx-auto text-center py-12">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-db-navy mb-2">Submitted!</h2>
        <p className="text-sm text-db-grey-mid mb-4">Saved as draft — an admin will review and publish it.</p>
        <button onClick={resetForm} className="bg-db-red text-white px-4 py-2 rounded-lg text-sm hover:bg-db-red-dark transition-colors">
          Submit another
        </button>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h1 className="text-xl font-bold text-db-navy">Submit New Entry</h1>

      {/* Type tabs */}
      <div className="flex gap-2">
        {(['tool', 'story'] as ContentType[]).map((t) => (
          <button key={t} onClick={() => setType(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${type === t ? 'bg-db-navy text-white' : 'bg-white border border-gray-200 text-db-grey-mid hover:border-db-navy'}`}>
            {t === 'tool' ? 'Tool / System' : 'Customer Story'}
          </button>
        ))}
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── TOOL FORM ── */}
          {type === 'tool' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Tool Name *">
                  <input required value={toolForm.name} onChange={(e) => setToolForm({ ...toolForm, name: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Vendor">
                  <input value={toolForm.vendor} onChange={(e) => setToolForm({ ...toolForm, vendor: e.target.value })} className={inputCls} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Category">
                  <ComboBox
                    value={toolForm.category}
                    onChange={(v) => setToolForm({ ...toolForm, category: v })}
                    options={toolCategories}
                    placeholder="Select or create..."
                  />
                </Field>
                <Field label="Integration Type">
                  <select value={toolForm.integration_type} onChange={(e) => setToolForm({ ...toolForm, integration_type: e.target.value })} className={inputCls}>
                    {INTEGRATION_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
              </div>

              {/* Description with Generate button */}
              <Field label="Description">
                <div className="space-y-1.5">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={generating || !toolForm.name.trim()}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-db-navy text-white text-xs font-medium hover:bg-db-navy-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {generating ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
                      ) : (
                        <><Sparkles className="w-3 h-3" /> Generate with AI</>
                      )}
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={toolForm.description}
                    onChange={(e) => setToolForm({ ...toolForm, description: e.target.value })}
                    placeholder="What is this tool and what does it do in the energy/utilities context?"
                    className={inputCls}
                  />
                </div>
              </Field>

              <Field label="Databricks Integration">
                <textarea
                  rows={3}
                  value={toolForm.databricks_integration}
                  onChange={(e) => setToolForm({ ...toolForm, databricks_integration: e.target.value })}
                  placeholder="How does this tool integrate with Databricks?"
                  className={inputCls}
                />
              </Field>

              <Field label="Website URL">
                <input type="url" value={toolForm.website_url} onChange={(e) => setToolForm({ ...toolForm, website_url: e.target.value })} className={inputCls} />
              </Field>

              <Field label="Tags">
                <TagInput
                  value={toolForm.tags}
                  onChange={(tags) => setToolForm({ ...toolForm, tags })}
                  suggestions={allTags}
                  placeholder="Select or create tags..."
                />
              </Field>
            </>
          )}

          {/* ── STORY FORM ── */}
          {type === 'story' && (
            <>
              <Field label="Story Title *">
                <input required value={storyForm.title} onChange={(e) => setStoryForm({ ...storyForm, title: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Customer Name">
                <input value={storyForm.customer_name} onChange={(e) => setStoryForm({ ...storyForm, customer_name: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Summary">
                <textarea rows={3} value={storyForm.summary} onChange={(e) => setStoryForm({ ...storyForm, summary: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Challenge">
                <textarea rows={2} value={storyForm.challenge} onChange={(e) => setStoryForm({ ...storyForm, challenge: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Outcome">
                <textarea rows={2} value={storyForm.outcome} onChange={(e) => setStoryForm({ ...storyForm, outcome: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Databricks Products Used">
                <input value={storyForm.databricks_products} onChange={(e) => setStoryForm({ ...storyForm, databricks_products: e.target.value })} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="SF Opportunity URL">
                  <input type="url" value={storyForm.salesforce_opportunity_url} onChange={(e) => setStoryForm({ ...storyForm, salesforce_opportunity_url: e.target.value })} className={inputCls} />
                </Field>
                <Field label="SF Account URL">
                  <input type="url" value={storyForm.salesforce_account_url} onChange={(e) => setStoryForm({ ...storyForm, salesforce_account_url: e.target.value })} className={inputCls} />
                </Field>
              </div>
              <Field label="Tags">
                <TagInput value={storyForm.tags} onChange={(tags) => setStoryForm({ ...storyForm, tags })} suggestions={allTags} placeholder="Select or create tags..." />
              </Field>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={storyForm.is_referenceable} onChange={(e) => setStoryForm({ ...storyForm, is_referenceable: e.target.checked })} className="rounded border-gray-300" />
                This story can be shared externally (referenceable)
              </label>
            </>
          )}

          {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}

          <button type="submit" disabled={submitting}
            className="w-full bg-db-red text-white py-2.5 rounded-lg font-medium text-sm hover:bg-db-red-dark disabled:opacity-60 transition-colors">
            {submitting ? 'Submitting...' : 'Submit as Draft'}
          </button>
        </form>
      </Card>
    </div>
  );
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-db-blue/30 focus:border-db-blue';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-db-grey-mid uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  );
}
