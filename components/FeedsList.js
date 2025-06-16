import { useState, useEffect } from 'react';

export default function FeedsList({ user }) {
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeeds();
  }, [user]);

  const loadFeeds = async () => {
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/feeds', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setFeeds(data.feeds || []);
    } catch (error) {
      console.error('Error loading feeds:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (feedId) => {
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ feedId })
      });
      
      if (response.ok) {
        alert('Sync started successfully');
        loadFeeds();
      }
    } catch (error) {
      console.error('Error starting sync:', error);
    }
  };

  const handlePauseResume = async (feedId, action) => {
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/sync', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ feedId, action })
      });
      
      if (response.ok) {
        alert(`Feed ${action}d successfully`);
        loadFeeds();
      }
    } catch (error) {
      console.error(`Error ${action}ing feed:`, error);
    }
  };

  const handleDelete = async (feedId) => {
    if (!confirm('Are you sure you want to delete this feed?')) return;
    
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/feeds?feedId=${feedId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        loadFeeds();
      }
    } catch (error) {
      console.error('Error deleting feed:', error);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 style={{ marginBottom: '1rem' }}>Your Feeds</h2>
      
      {feeds.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No feeds found. Add your first feed to get started.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Last Sync</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {feeds.map(feed => (
              <tr key={feed.id}>
                <td>{feed.name}</td>
                <td style={{ textTransform: 'capitalize' }}>{feed.type}</td>
                <td>
                  <span className={`status-badge ${feed.isPaused ? 'status-paused' : 'status-active'}`}>
                    {feed.isPaused ? 'Paused' : 'Active'}
                  </span>
                </td>
                <td>
                  {feed.lastSyncAt 
                    ? new Date(feed.lastSyncAt.seconds * 1000).toLocaleString()
                    : 'Never'
                  }
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => handleSync(feed.id)}
                      className="btn btn-primary"
                      style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                    >
                      Sync Now
                    </button>
                    <button 
                      onClick={() => handlePauseResume(feed.id, feed.isPaused ? 'resume' : 'pause')}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                    >
                      {feed.isPaused ? 'Resume' : 'Pause'}
                    </button>
                    <button 
                      onClick={() => handleDelete(feed.id)}
                      className="btn btn-danger"
                      style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}