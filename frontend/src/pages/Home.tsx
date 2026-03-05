import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, BookOpen, Building2, Zap, Clock, TrendingUp } from 'lucide-react';
import { User } from '../hooks/useAuth';
import { SearchBar } from '../components/SearchBar';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';

interface Tool {
  id: number;
  name: string;
  vendor: string;
  category: string;
  description: string;
  integration_type: string;
  status: string;
  created_at: string;
  customer_count?: number;
  live_count?: number;
  implementing_count?: number;
  identified_count?: number;
  customer_names?: string[];
}

interface Story {
  id: number;
  title: string;
  customer_name: string;
  status: string;
  created_at: string;
}

interface HomeProps {
  user: User | null;
}

export function Home({ user }: HomeProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [tools, setTools] = useState<Tool[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/tools').then((r) => r.json()),
      fetch('/api/stories').then((r) => r.json()),
    ])
      .then(([t, s]) => {
        setTools(Array.isArray(t) ? t : []);
        setStories(Array.isArray(s) ? s : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) navigate(`/tools?search=${encodeURIComponent(search)}`);
  };

  const totalImplementing = tools.reduce((sum, t) => sum + (t.implementing_count ?? 0), 0);

  // Top tools by customer adoption (any stage)
  const topTools = [...tools]
    .filter((t) => (t.customer_count ?? 0) > 0)
    .sort((a, b) => (b.customer_count ?? 0) - (a.customer_count ?? 0))
    .slice(0, 6);

  // Recent additions across tools + stories, sorted by created_at
  type RecentItem = { id: number; title: string; type: 'tool' | 'story'; sub: string; created_at: string };
  const recentItems: RecentItem[] = [
    ...tools.map((t) => ({ id: t.id, title: t.name, type: 'tool' as const, sub: t.category, created_at: t.created_at })),
    ...stories.map((s) => ({ id: s.id, title: s.title, type: 'story' as const, sub: s.customer_name, created_at: s.created_at })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  const stats = [
    { label: 'Tools & Systems', value: tools.length, icon: Wrench, color: 'bg-db-blue/10 text-db-blue', href: '/tools' },
    { label: 'Customer Stories', value: stories.length, icon: BookOpen, color: 'bg-amber-50 text-amber-600', href: '/stories' },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-db-navy rounded-2xl px-6 sm:px-8 py-8 flex flex-col items-center text-center gap-4">
        <div className="flex items-center gap-2 text-db-blue text-xs font-semibold uppercase tracking-widest">
          <Zap className="w-3.5 h-3.5" /> ANZ Energy &amp; Utilities
        </div>
        <h1 className="text-2xl font-bold text-white leading-tight">FE Industry Hub</h1>
        <p className="text-white/60 max-w-md text-sm">
          Track tools, customer adoption, and success stories across the ANZ Energy &amp; Utilities sector.
        </p>
        <form onSubmit={handleSearch} className="w-full max-w-md">
          <SearchBar value={search} onChange={setSearch} placeholder="Search tools and systems..." className="w-full" />
        </form>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4">
        {stats.map(({ label, value, icon: Icon, color, href }) => (
          <Card key={label} hover onClick={() => navigate(href)} className="cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-db-navy leading-none mb-1">
                  {loading ? '—' : value}
                </div>
                <div className="text-sm text-db-grey-mid">{label}</div>
              </div>
              <div className={`p-3 rounded-xl ${color}`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* Top adopted tools (2/3 width) */}
        <div className="md:col-span-2">
          <h2 className="text-sm font-semibold text-db-navy mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-db-blue" /> Top Adopted Tools
          </h2>
          {loading ? (
            <div className="text-sm text-db-grey-mid py-6 text-center">Loading...</div>
          ) : topTools.length === 0 ? (
            <Card className="py-8 text-center">
              <p className="text-sm text-db-grey-mid">No customer adoption tracked yet.</p>
              <p className="text-xs text-gray-400 mt-1">Open a tool and add customers to see them here.</p>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {topTools.map((tool) => (
                <Card key={tool.id} hover onClick={() => navigate(`/tools?id=${tool.id}`)} className="cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-db-navy text-sm">{tool.name}</span>
                        {tool.vendor && <span className="text-xs text-db-grey-mid">{tool.vendor}</span>}
                        <Badge variant="category">{tool.category}</Badge>
                      </div>
                      {/* Stage breakdown */}
                      <div className="flex items-center gap-2 flex-wrap">
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
                        {tool.customer_names && tool.customer_names.length > 0 && (
                          <span className="text-xs text-gray-400">
                            {tool.customer_names.slice(0, 3).join(', ')}
                            {tool.customer_names.length > 3 && ` +${tool.customer_names.length - 3}`}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Adoption bar */}
                    <div className="flex-shrink-0 text-right">
                      <div className="text-lg font-bold text-db-navy leading-none">{tool.customer_count}</div>
                      <div className="text-xs text-db-grey-mid">customers</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Recent additions (1/3 width) */}
        <div>
          <h2 className="text-sm font-semibold text-db-navy mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-db-blue" /> Recent Additions
          </h2>
          {loading ? (
            <div className="text-sm text-db-grey-mid py-6 text-center">Loading...</div>
          ) : recentItems.length === 0 ? (
            <Card className="py-8 text-center">
              <p className="text-sm text-db-grey-mid">Nothing yet.</p>
              {user && (user.role === 'contributor' || user.role === 'admin') && (
                <button onClick={() => navigate('/submit')}
                  className="mt-3 bg-db-red text-white px-4 py-2 rounded-lg text-sm hover:bg-db-red-dark transition-colors">
                  Add first entry
                </button>
              )}
            </Card>
          ) : (
            <div className="space-y-1.5">
              {recentItems.map((item) => (
                <Card
                  key={`${item.type}-${item.id}`}
                  hover
                  onClick={() => navigate(`${item.type === 'tool' ? '/tools' : '/stories'}?id=${item.id}`)}
                  className="cursor-pointer py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-db-navy leading-tight truncate">{item.title}</div>
                      {item.sub && <div className="text-xs text-db-grey-mid mt-0.5 truncate">{item.sub}</div>}
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 font-medium ${
                      item.type === 'tool' ? 'bg-db-blue/10 text-db-blue' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {item.type === 'tool' ? 'Tool' : 'Story'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(item.created_at).toLocaleDateString()}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Implementing pipeline — only show if there are any */}
      {!loading && totalImplementing > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-db-navy mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-500" /> Implementations In Progress
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tools
              .filter((t) => (t.implementing_count ?? 0) > 0)
              .sort((a, b) => (b.implementing_count ?? 0) - (a.implementing_count ?? 0))
              .map((tool) => (
                <Card key={tool.id} hover onClick={() => navigate(`/tools?id=${tool.id}`)} className="cursor-pointer">
                  <div className="font-semibold text-db-navy text-sm mb-1">{tool.name}</div>
                  <div className="text-xs text-gray-500 mb-2">{tool.vendor && `${tool.vendor} · `}{tool.category}</div>
                  <span className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-200 w-fit">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                    {tool.implementing_count} implementing
                  </span>
                </Card>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
