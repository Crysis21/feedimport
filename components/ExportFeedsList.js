import { useState, useEffect } from 'react';

export default function ExportFeedsList({ user }) {
  const [exportFeeds, setExportFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingFeed, setEditingFeed] = useState(null);

  useEffect(() => {
    if (user?.uid) {
      fetchExportFeeds();
    }
  }, [user]);

  const fetchExportFeeds = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/export-feeds', {
        headers: {
          'Authorization': `Bearer ${await user.getIdToken()}`
        }
      });
      const data = await response.json();

      if (response.ok) {
        setExportFeeds(data.exportFeeds || []);
      } else {
        console.error('Failed to fetch export feeds:', data.error);
      }
    } catch (error) {
      console.error('Error fetching export feeds:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (exportFeedId) => {
    if (!confirm('Are you sure you want to delete this export feed?')) {
      return;
    }

    try {
      const response = await fetch(`/api/export-feeds?exportFeedId=${exportFeedId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${await user.getIdToken()}`
        }
      });

      if (response.ok) {
        setExportFeeds(prev => prev.filter(f => f.id !== exportFeedId));
      } else {
        const data = await response.json();
        alert('Failed to delete export feed: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting export feed:', error);
      alert('Error deleting export feed');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('URL copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Export Feeds</h2>
        <button 
          onClick={() => setShowAddForm(true)} 
          className="btn btn-primary"
        >
          Add Export Feed
        </button>
      </div>

      {showAddForm && (
        <AddExportFeedForm 
          user={user}
          editingFeed={editingFeed}
          onClose={() => {
            setShowAddForm(false);
            setEditingFeed(null);
          }}
          onSaved={() => {
            setShowAddForm(false);
            setEditingFeed(null);
            fetchExportFeeds();
          }}
        />
      )}

      {exportFeeds.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h3 style={{ marginBottom: '1rem', color: '#6b7280' }}>No Export Feeds</h3>
          <p style={{ marginBottom: '2rem', color: '#9ca3af' }}>
            Create your first export feed to generate filtered XML feeds for external systems.
          </p>
          <button 
            onClick={() => setShowAddForm(true)} 
            className="btn btn-primary"
          >
            Create Export Feed
          </button>
        </div>
      ) : (
        <div className="grid">
          {exportFeeds.map(exportFeed => (
            <div key={exportFeed.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>{exportFeed.name}</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => {
                      setEditingFeed(exportFeed);
                      setShowAddForm(true);
                    }}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(exportFeed.id)}
                    className="btn btn-danger"
                    style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem' }}>
                  <div>
                    <strong>Pricing Multiplier:</strong> {exportFeed.pricingMultiplier || 1}x
                  </div>
                  <div>
                    <strong>Created:</strong> {new Date(exportFeed.createdAt.seconds * 1000).toLocaleDateString()}
                  </div>
                  <div>
                    <strong>Access Count:</strong> {exportFeed.accessCount || 0}
                  </div>
                  <div>
                    <strong>Last Accessed:</strong> {exportFeed.lastAccessedAt ? 
                      new Date(exportFeed.lastAccessedAt.seconds * 1000).toLocaleDateString() : 'Never'}
                  </div>
                </div>
              </div>

              {exportFeed.filters && Object.keys(exportFeed.filters).length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Filters:</strong>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                    {exportFeed.filters.brand && <div>Brand: {exportFeed.filters.brand}</div>}
                    {exportFeed.filters.category && <div>Category: {exportFeed.filters.category}</div>}
                    {exportFeed.filters.emagCategoryId && <div>eMAG Category ID: {exportFeed.filters.emagCategoryId}</div>}
                    {exportFeed.filters.emagCategoryName && <div>eMAG Category: {exportFeed.filters.emagCategoryName}</div>}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <strong>Public XML URL:</strong>
                <div style={{ 
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  background: '#f3f4f6',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all'
                }}>
                  {`${window.location.origin}/api/export/${exportFeed.uuid}`}
                </div>
                <button
                  onClick={() => copyToClipboard(`${window.location.origin}/api/export/${exportFeed.uuid}`)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}
                >
                  Copy URL
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddExportFeedForm({ user, editingFeed, onClose, onSaved }) {
  const [formData, setFormData] = useState({
    name: '',
    feedId: '',
    pricingMultiplier: 1,
    filters: {
      brand: '',
      category: '',
      emagCategoryId: '',
      emagCategoryName: ''
    }
  });
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFeeds();
    if (editingFeed) {
      setFormData({
        name: editingFeed.name || '',
        feedId: editingFeed.feedId || '',
        pricingMultiplier: editingFeed.pricingMultiplier || 1,
        filters: editingFeed.filters || {
          brand: '',
          category: '',
          emagCategoryId: '',
          emagCategoryName: ''
        }
      });
    }
  }, [editingFeed]);

  const fetchFeeds = async () => {
    try {
      const response = await fetch('/api/feeds', {
        headers: {
          'Authorization': `Bearer ${await user.getIdToken()}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setFeeds(data.feeds || []);
      }
    } catch (error) {
      console.error('Error fetching feeds:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const method = editingFeed ? 'PUT' : 'POST';
      const url = editingFeed ? `/api/export-feeds?exportFeedId=${editingFeed.id}` : '/api/export-feeds';
      
      // Filter out empty filter values
      const filters = Object.fromEntries(
        Object.entries(formData.filters).filter(([key, value]) => value && value.trim())
      );

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({
          ...formData,
          filters
        })
      });

      const data = await response.json();

      if (response.ok) {
        onSaved();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving export feed:', error);
      alert('Error saving export feed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3>{editingFeed ? 'Edit Export Feed' : 'Add Export Feed'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem' }}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label>Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="My Export Feed"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label>Source Feed (optional)</label>
            <select
              value={formData.feedId}
              onChange={(e) => setFormData({ ...formData, feedId: e.target.value })}
            >
              <option value="">All feeds</option>
              {feeds.map(feed => (
                <option key={feed.id} value={feed.id}>
                  {feed.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label>Pricing Multiplier</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={formData.pricingMultiplier}
              onChange={(e) => setFormData({ ...formData, pricingMultiplier: parseFloat(e.target.value) || 1 })}
              placeholder="1.0"
            />
          </div>

          <h4 style={{ marginBottom: '1rem' }}>Filters (optional)</h4>

          <div style={{ marginBottom: '1rem' }}>
            <label>Brand</label>
            <input
              type="text"
              value={formData.filters.brand}
              onChange={(e) => setFormData({ 
                ...formData, 
                filters: { ...formData.filters, brand: e.target.value }
              })}
              placeholder="Brand name"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label>Category</label>
            <input
              type="text"
              value={formData.filters.category}
              onChange={(e) => setFormData({ 
                ...formData, 
                filters: { ...formData.filters, category: e.target.value }
              })}
              placeholder="Category name"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label>eMAG Category ID</label>
            <input
              type="text"
              value={formData.filters.emagCategoryId}
              onChange={(e) => setFormData({ 
                ...formData, 
                filters: { ...formData.filters, emagCategoryId: e.target.value }
              })}
              placeholder="eMAG category ID"
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label>eMAG Category Name</label>
            <input
              type="text"
              value={formData.filters.emagCategoryName}
              onChange={(e) => setFormData({ 
                ...formData, 
                filters: { ...formData.filters, emagCategoryName: e.target.value }
              })}
              placeholder="eMAG category name"
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Saving...' : (editingFeed ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}