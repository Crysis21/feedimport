import { useState } from 'react';

export default function AddFeedForm({ user, onFeedAdded }) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'boribon',
    uuid: '',
    url: '',
    syncInterval: 3600000
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/feeds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setFormData({
          name: '',
          type: 'boribon',
          uuid: '',
          url: '',
          syncInterval: 3600000
        });
        onFeedAdded();
        alert('Feed added successfully!');
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error adding feed:', error);
      alert('Error adding feed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'syncInterval' ? parseInt(value) : value
    }));
  };

  return (
    <div className="card">
      <h2 style={{ marginBottom: '1rem' }}>Add New Feed</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Feed Name</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="form-input"
            required
            placeholder="My Product Feed"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Feed Type</label>
          <select
            name="type"
            value={formData.type}
            onChange={handleChange}
            className="form-input"
            required
          >
            <option value="boribon">Boribon</option>
            <option value="custom">Custom XML Feed</option>
          </select>
        </div>

        {formData.type === 'boribon' && (
          <div className="form-group">
            <label className="form-label">Boribon UUID</label>
            <input
              type="text"
              name="uuid"
              value={formData.uuid}
              onChange={handleChange}
              className="form-input"
              required
              placeholder="your-uuid-here"
            />
          </div>
        )}

        {formData.type === 'custom' && (
          <div className="form-group">
            <label className="form-label">Feed URL</label>
            <input
              type="url"
              name="url"
              value={formData.url}
              onChange={handleChange}
              className="form-input"
              required
              placeholder="https://example.com/feed.xml"
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Sync Interval</label>
          <select
            name="syncInterval"
            value={formData.syncInterval}
            onChange={handleChange}
            className="form-input"
          >
            <option value={900000}>15 minutes</option>
            <option value={1800000}>30 minutes</option>
            <option value={3600000}>1 hour</option>
            <option value={7200000}>2 hours</option>
            <option value={21600000}>6 hours</option>
            <option value={43200000}>12 hours</option>
            <option value={86400000}>24 hours</option>
          </select>
        </div>

        <button 
          type="submit" 
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? 'Adding...' : 'Add Feed'}
        </button>
      </form>
    </div>
  );
}