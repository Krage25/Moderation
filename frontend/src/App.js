import './App.css';
import React, { useEffect, useState } from 'react';
import { Menu, Plus, Database, Download, FileText, BarChart3, X, Link2, AlertCircle, CheckCircle } from 'lucide-react';

const API_URL = 'http://10.226.49.29:8080';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('add');
  const [url, setUrl] = useState('');
  const [comments, setComments] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [links, setLinks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [platform, setPlatform] = useState('');
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState(null);
  const [downloadCount, setDownloadCount] = useState(0);
  const [downloadUser, setDownloadUser] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  function detectPlatform(u) {
    if (!u) return '';
    const s = u.toLowerCase();
    if (s.includes('twitter.com') || s.includes('x.com')) return 'Twitter';
    if (s.includes('facebook.com')) return 'Facebook';
    if (s.includes('instagram.com')) return 'Instagram';
    if (s.includes('youtube.com')) return 'YouTube';
    if (s.includes('t.me') || s.includes('telegram.org')) return 'Telegram';
    if (s.includes('whatsapp.com')) return 'WhatsApp';
    if (s.includes('reddit.com')) return 'Reddit';
    return 'Other';
  }

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  async function addLink(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { url: url.trim(), comments };
      const res = await fetch(`${API_URL}/add_link/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Failed');
      showMessage('success', data.message);
      setUrl('');
      setComments('');
      setPlatform('');
    } catch (err) {
      showMessage('error', err.message);
    } finally {
      setLoading(false);
    }
  }

  function toIso(val) {
    if (!val) return '';
    try {
      const date = new Date(val);
      if (isNaN(date.getTime())) return '';
      return date.toISOString();
    } catch (err) {
      console.error('Invalid date:', val);
      return '';
    }
  }

  async function fetchLinks() {
    if (!fromDate || !toDate) {
      showMessage('error', 'Please select both From and To dates.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/get_links/?from_date=${encodeURIComponent(toIso(fromDate))}&to_date=${encodeURIComponent(toIso(toDate))}`
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setLinks(data.data || []);
      showMessage('success', `Fetched ${data.data?.length || 0} records`);
      setActiveTab('view');
    } catch (err) {
      showMessage('error', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLogs() {
    try {
      const res = await fetch(`${API_URL}/get_logs/`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setLogs(data.logs || []);
    } catch (err) {
      console.warn('Failed to fetch logs', err);
    }
  }

  async function logDownload() {
    if (!fromDate || !toDate) {
      showMessage('error', 'Please choose date range to log.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        from_date: toIso(fromDate),
        to_date: toIso(toDate),
        count: Number(downloadCount) || 0,
        user: downloadUser || 'unknown',
      };
      const res = await fetch(`${API_URL}/log_download/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message);
      showMessage('success', data.message);
      fetchLogs();
    } catch (err) {
      showMessage('error', err.message);
    } finally {
      setLoading(false);
    }
  }

  function latin1ToUint8Array(s) {
    const arr = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
    return arr;
  }

  async function exportFile(type = 'pdf') {
    if (!fromDate || !toDate) {
      showMessage('error', 'Please select From and To dates for export.');
      return;
    }
    setExporting(true);
    try {
      const urlStr = `${API_URL}/export/?from_date=${encodeURIComponent(toIso(fromDate))}&to_date=${encodeURIComponent(toIso(toDate))}&file_type=${type}`;
      const res = await fetch(urlStr);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Export failed');

      const latin1 = data.file;
      if (!latin1) throw new Error('No file content returned');

      const bytes = latin1ToUint8Array(latin1);
      const blob = new Blob([bytes], {
        type: type === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      const filename = `violations_${fromDate}_${toDate}.${type}`;
      const linkEl = document.createElement('a');
      linkEl.href = URL.createObjectURL(blob);
      linkEl.download = filename;
      document.body.appendChild(linkEl);
      linkEl.click();
      linkEl.remove();

      showMessage('success', 'File downloaded successfully');
    } catch (err) {
      showMessage('error', err.message);
    } finally {
      setExporting(false);
    }
  }

  const navItems = [
    { id: 'add', label: 'Add Link', icon: Plus },
    { id: 'view', label: 'View Links', icon: Database },
    { id: 'export', label: 'Export', icon: Download },
    { id: 'logs', label: 'Download Logs', icon: BarChart3 },
  ];

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gradient-to-b from-indigo-900 to-indigo-800 text-white transition-all duration-300 flex flex-col shadow-2xl`}>
        <div className="p-6 flex items-center justify-between border-b border-indigo-700">
          {sidebarOpen && <h1 className="text-xl font-bold">IT Rules Logger</h1>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-indigo-700 rounded-lg transition">
            <Menu size={24} />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  activeTab === item.id
                    ? 'bg-indigo-600 shadow-lg'
                    : 'hover:bg-indigo-700/50'
                }`}
              >
                <Icon size={20} />
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {sidebarOpen && (
          <div className="p-4 border-t border-indigo-700 text-xs text-indigo-200">
            <p>API: {API_URL}</p>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8">
          {/* Message Toast */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in ${
              message.type === 'error'
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-green-50 text-green-800 border border-green-200'
            }`}>
              {message.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
              <span className="flex-1">{message.text}</span>
              <button onClick={() => setMessage(null)} className="p-1 hover:bg-white/50 rounded">
                <X size={18} />
              </button>
            </div>
          )}

          {/* Add Link Tab */}
          {activeTab === 'add' && (
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <Plus className="text-indigo-600" size={28} />
                <h2 className="text-2xl font-bold text-gray-800">Add New Link</h2>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">URL</label>
                  <input
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setPlatform(detectPlatform(e.target.value));
                    }}
                    placeholder="Enter social media URL"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                </div>

                {platform && (
                  <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center gap-3">
                    <Link2 className="text-indigo-600" size={20} />
                    <span className="text-sm text-gray-700">
                      Detected Platform: <span className="font-semibold text-indigo-700">{platform}</span>
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Comments (Optional)</label>
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Add any additional notes..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={(e) => addLink(e)}
                    disabled={loading || !url}
                    className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {loading ? 'Adding...' : 'Add Link'}
                  </button>
                  <button
                    onClick={() => {
                      setUrl('');
                      setComments('');
                      setPlatform('');
                    }}
                    className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* View Links Tab */}
          {activeTab === 'view' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-xl p-8">
                <div className="flex items-center gap-3 mb-6">
                  <Database className="text-indigo-600" size={28} />
                  <h2 className="text-2xl font-bold text-gray-800">View Links</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">From Date & Time</label>
                    <input
                      type="datetime-local"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">To Date & Time</label>
                    <input
                      type="datetime-local"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={fetchLinks}
                      disabled={loading}
                      className="w-full bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
                    >
                      {loading ? 'Loading...' : 'Fetch Links'}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-indigo-50 to-indigo-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">S.No</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">URL</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Platform</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Violation</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Timestamp</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Comments</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {links.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                            No records found. Select a date range and click Fetch Links.
                          </td>
                        </tr>
                      ) : (
                        links.map((l, i) => (
                          <tr key={i} className="hover:bg-gray-50 transition">
                            <td className="px-4 py-3 text-sm">{i + 1}</td>
                            <td className="px-4 py-3 text-sm">
                              <a href={l.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-800 underline">
                                {l.url.length > 50 ? l.url.substring(0, 50) + '...' : l.url}
                              </a>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                                {l.platform}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">{l.rule_violation}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                {l.action_status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{l.timestamp}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{l.comments || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Export Tab */}
          {activeTab === 'export' && (
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <Download className="text-indigo-600" size={28} />
                <h2 className="text-2xl font-bold text-gray-800">Export Reports</h2>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">From Date & Time</label>
                    <input
                      type="datetime-local"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">To Date & Time</label>
                    <input
                      type="datetime-local"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => exportFile('pdf')}
                    disabled={exporting}
                    className="flex items-center justify-center gap-2 bg-red-600 text-white px-6 py-4 rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-50 shadow-lg"
                  >
                    <FileText size={20} />
                    {exporting ? 'Exporting...' : 'Export as PDF'}
                  </button>
                  <button
                    onClick={() => exportFile('docx')}
                    disabled={exporting}
                    className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-4 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 shadow-lg"
                  >
                    <FileText size={20} />
                    {exporting ? 'Exporting...' : 'Export as DOCX'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <BarChart3 className="text-indigo-600" size={28} />
                  <h2 className="text-2xl font-bold text-gray-800">Download Logs</h2>
                </div>
                <button
                  onClick={fetchLogs}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Refresh
                </button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-indigo-50 to-indigo-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">From Date</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">To Date</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Count</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">User</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Logged At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                          No logs available yet.
                        </td>
                      </tr>
                    ) : (
                      logs.map((lg, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-3 text-sm text-gray-600">{lg.from_date}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{lg.to_date}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                              {lg.count}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{lg.user}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{lg.timestamp}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      <style>{`
        @keyframes slide-in {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}