import { useEffect, useState } from 'react';
import { CheckCircle, Users, FileText, Activity } from 'lucide-react';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';

interface AdminUser {
  id: number;
  email: string;
  display_name: string;
  role: string;
  created_at: string;
}

interface Draft {
  id: number;
  title: string;
  type: string;
  created_by: string;
  created_at: string;
}

interface AuditEntry {
  id: number;
  actor_email: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  entity_name: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

type Tab = 'drafts' | 'users' | 'audit';

const TYPE_LABELS: Record<string, string> = { tool: 'Tool', use_case: 'Use Case', story: 'Story' };

export function Admin() {
  const [tab, setTab] = useState<Tab>('drafts');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Add user form
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('viewer');
  const [addingUser, setAddingUser] = useState(false);

  const loadDrafts = () => {
    fetch('/api/admin/drafts')
      .then((r) => r.json())
      .then((data) => setDrafts(data.drafts || []))
      .catch(() => setDrafts([]));
  };

  const loadUsers = () => {
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => setUsers([]));
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/admin/drafts').then((r) => r.json()),
      fetch('/api/admin/users').then((r) => r.json()),
    ]).then(([draftsData, usersData]) => {
      setDrafts(draftsData.drafts || []);
      setUsers(usersData || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const publishDraft = async (draft: Draft, action: 'publish' | 'unpublish') => {
    await fetch(`/api/admin/publish/${draft.type}/${draft.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    loadDrafts();
  };

  const changeRole = async (userId: number, role: string) => {
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    loadUsers();
  };

  const loadAuditLog = () => {
    setAuditLoading(true);
    fetch('/api/admin/audit')
      .then((r) => r.json())
      .then(setAuditLog)
      .catch(() => setAuditLog([]))
      .finally(() => setAuditLoading(false));
  };

  const handleTabChange = (t: Tab) => {
    setTab(t);
    if (t === 'audit' && auditLog.length === 0) loadAuditLog();
  };

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    setAddingUser(true);
    try {
      await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, role: newRole }),
      });
      setNewEmail('');
      loadUsers();
    } finally {
      setAddingUser(false);
    }
  };

  if (loading) {
    return <div className="text-center py-10 text-db-grey-mid text-sm">Loading...</div>;
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-db-navy">Admin</h1>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => handleTabChange('drafts')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'drafts' ? 'bg-db-navy text-white' : 'bg-white border border-gray-200 text-db-grey-mid hover:border-db-navy'
          }`}
        >
          <FileText className="w-4 h-4" />
          Draft Review
          {drafts.length > 0 && (
            <span className="ml-1 bg-db-red text-white text-xs rounded-full px-1.5 py-0.5">{drafts.length}</span>
          )}
        </button>
        <button
          onClick={() => handleTabChange('users')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'users' ? 'bg-db-navy text-white' : 'bg-white border border-gray-200 text-db-grey-mid hover:border-db-navy'
          }`}
        >
          <Users className="w-4 h-4" />
          Users
          <span className="ml-1 text-xs text-db-grey-mid">({users.length})</span>
        </button>
        <button
          onClick={() => handleTabChange('audit')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'audit' ? 'bg-db-navy text-white' : 'bg-white border border-gray-200 text-db-grey-mid hover:border-db-navy'
          }`}
        >
          <Activity className="w-4 h-4" />
          Audit Log
        </button>
      </div>

      {/* Drafts tab */}
      {tab === 'drafts' && (
        <div className="space-y-3">
          {drafts.length === 0 ? (
            <Card className="text-center py-10">
              <p className="text-db-grey-mid text-sm">No pending drafts.</p>
            </Card>
          ) : (
            drafts.map((draft) => (
              <Card key={`${draft.type}-${draft.id}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-db-navy text-sm truncate">{draft.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="category">{TYPE_LABELS[draft.type] || draft.type}</Badge>
                      <span className="text-xs text-db-grey-mid">by {draft.created_by}</span>
                      <span className="text-xs text-gray-400">{new Date(draft.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => publishDraft(draft, 'publish')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Publish
                    </button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Users tab */}
      {tab === 'users' && (
        <div className="space-y-4">
          {/* Add user */}
          <Card>
            <h3 className="text-sm font-semibold text-db-navy mb-3">Add Team Member</h3>
            <form onSubmit={addUser} className="flex gap-3">
              <input
                type="email"
                required
                placeholder="email@databricks.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-db-blue/30"
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-db-blue/30"
              >
                <option value="viewer">Viewer</option>
                <option value="contributor">Contributor</option>
                <option value="admin">Admin</option>
              </select>
              <button
                type="submit"
                disabled={addingUser}
                className="bg-db-red text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-db-red-dark disabled:opacity-60 transition-colors"
              >
                Add
              </button>
            </form>
          </Card>

          {/* User list */}
          <div className="space-y-2">
            {users.map((u) => (
              <Card key={u.id}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium text-sm text-db-navy">{u.display_name}</div>
                    <div className="text-xs text-db-grey-mid">{u.email}</div>
                  </div>
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-db-blue/30"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="contributor">Contributor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
      {/* Audit Log tab */}
      {tab === 'audit' && (
        <div className="space-y-2">
          {auditLoading ? (
            <div className="text-center py-10 text-db-grey-mid text-sm">Loading...</div>
          ) : auditLog.length === 0 ? (
            <Card className="text-center py-10">
              <p className="text-db-grey-mid text-sm">No audit entries yet.</p>
            </Card>
          ) : (
            auditLog.map((entry) => (
              <Card key={entry.id} className="py-2.5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${actionColor(entry.action)}`}>
                        {entry.action}
                      </span>
                      <span className="text-xs font-medium text-db-grey-dark capitalize">{entry.entity_type.replace('_', ' ')}</span>
                      {entry.entity_name && (
                        <span className="text-xs text-db-navy font-medium truncate max-w-xs">{entry.entity_name}</span>
                      )}
                      {entry.details && (
                        <span className="text-xs text-gray-400 truncate">
                          {formatDetails(entry.details)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-db-grey-mid mt-1">{entry.actor_email}</div>
                  </div>
                  <div className="text-xs text-gray-400 flex-shrink-0 text-right">
                    {new Date(entry.created_at).toLocaleString()}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function actionColor(action: string): string {
  switch (action) {
    case 'create': return 'bg-green-100 text-green-700';
    case 'update': return 'bg-blue-100 text-blue-700';
    case 'publish': return 'bg-emerald-100 text-emerald-700';
    case 'unpublish': return 'bg-yellow-100 text-yellow-700';
    case 'role_change': return 'bg-purple-100 text-purple-700';
    case 'add_user': return 'bg-indigo-100 text-indigo-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function formatDetails(details: Record<string, unknown>): string {
  if (details.changed_fields && Array.isArray(details.changed_fields)) {
    return `changed: ${(details.changed_fields as string[]).join(', ')}`;
  }
  if (details.new_role) return `→ ${details.new_role}`;
  if (details.role) return `role: ${details.role}`;
  if (details.new_status) return `→ ${details.new_status}`;
  return '';
}
