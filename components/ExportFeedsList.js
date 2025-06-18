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
                    {/* Legacy filters */}
                    {exportFeed.filters.brand && <div>Brand: {exportFeed.filters.brand}</div>}
                    {exportFeed.filters.category && <div>Category: {exportFeed.filters.category}</div>}
                    {exportFeed.filters.emagCategoryId && <div>eMAG Category ID: {exportFeed.filters.emagCategoryId}</div>}
                    {exportFeed.filters.emagCategoryName && <div>eMAG Category: {exportFeed.filters.emagCategoryName}</div>}
                    
                    {/* New enhanced filters */}
                    {exportFeed.filters.brands && exportFeed.filters.brands.length > 0 && (
                      <div>Brands: {exportFeed.filters.brands.join(', ')}</div>
                    )}
                    {exportFeed.filters.includeCategories && exportFeed.filters.includeCategories.length > 0 && (
                      <div style={{ color: '#059669' }}>Include Categories: {exportFeed.filters.includeCategories.join(', ')}</div>
                    )}
                    {exportFeed.filters.excludeCategories && exportFeed.filters.excludeCategories.length > 0 && (
                      <div style={{ color: '#dc2626' }}>Exclude Categories: {exportFeed.filters.excludeCategories.join(', ')}</div>
                    )}
                    {exportFeed.filters.includeEmagCategories && exportFeed.filters.includeEmagCategories.length > 0 && (
                      <div style={{ color: '#059669' }}>Include eMAG Categories: {exportFeed.filters.includeEmagCategories.join(', ')}</div>
                    )}
                    {exportFeed.filters.excludeEmagCategories && exportFeed.filters.excludeEmagCategories.length > 0 && (
                      <div style={{ color: '#dc2626' }}>Exclude eMAG Categories: {exportFeed.filters.excludeEmagCategories.join(', ')}</div>
                    )}
                  </div>
                </div>
              )}
              
              {exportFeed.maxItems && (
                <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  <strong>Max Items:</strong> {parseInt(exportFeed.maxItems).toLocaleString()}
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
    maxItems: '',
    filters: {
      brands: [],
      includeCategories: [],
      excludeCategories: [],
      includeEmagCategories: [],
      excludeEmagCategories: []
    }
  });
  const [feeds, setFeeds] = useState([]);
  const [brands, setBrands] = useState([]);
  const [originalCategories, setOriginalCategories] = useState([]);
  const [emagCategories, setEmagCategories] = useState([]);
  const [productCount, setProductCount] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [previewProducts, setPreviewProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [searchTerms, setSearchTerms] = useState({
    brand: '',
    originalCategory: '',
    emagCategory: ''
  });

  useEffect(() => {
    fetchFeeds();
    fetchMetadata();
    if (editingFeed) {
      setFormData({
        name: editingFeed.name || '',
        feedId: editingFeed.feedId || '',
        pricingMultiplier: editingFeed.pricingMultiplier || 1,
        maxItems: editingFeed.maxItems || '',
        filters: editingFeed.filters || {
          brands: [],
          includeCategories: [],
          excludeCategories: [],
          includeEmagCategories: [],
          excludeEmagCategories: []
        }
      });
    }
  }, [editingFeed]);

  useEffect(() => {
    if (formData.name) {
      updateProductCount();
    }
  }, [formData]);

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

  const fetchMetadata = async () => {
    try {
      const response = await fetch('/api/export-feeds/metadata', {
        headers: {
          'Authorization': `Bearer ${await user.getIdToken()}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setBrands(data.brands || []);
        setOriginalCategories(data.originalCategories || []);
        setEmagCategories(data.emagCategories || []);
      }
    } catch (error) {
      console.error('Error fetching metadata:', error);
    }
  };

  const updateProductCount = async () => {
    try {
      const response = await fetch('/api/export-feeds/count', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (response.ok) {
        setProductCount(data.count || 0);
      }
    } catch (error) {
      console.error('Error fetching product count:', error);
    }
  };

  const loadPreview = async () => {
    if (loadingPreview) return;
    setLoadingPreview(true);
    try {
      const response = await fetch('/api/export-feeds/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({ ...formData, limit: 10 })
      });
      const data = await response.json();
      if (response.ok) {
        setPreviewProducts(data.products || []);
        setShowPreview(true);
      }
    } catch (error) {
      console.error('Error loading preview:', error);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const method = editingFeed ? 'PUT' : 'POST';
      const url = editingFeed ? `/api/export-feeds?exportFeedId=${editingFeed.id}` : '/api/export-feeds';
      
      // Filter out empty arrays
      const filters = Object.fromEntries(
        Object.entries(formData.filters).filter(([key, value]) => 
          Array.isArray(value) ? value.length > 0 : value
        )
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

  const addToFilter = (filterType, value) => {
    if (!value || formData.filters[filterType].includes(value)) return;
    setFormData({
      ...formData,
      filters: {
        ...formData.filters,
        [filterType]: [...formData.filters[filterType], value]
      }
    });
  };

  const removeFromFilter = (filterType, value) => {
    setFormData({
      ...formData,
      filters: {
        ...formData.filters,
        [filterType]: formData.filters[filterType].filter(item => item !== value)
      }
    });
  };

  const getFilteredOptions = (options, searchTerm) => {
    if (!searchTerm) return options;
    return options.filter(option => 
      option.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content-large" onClick={e => e.stopPropagation()} style={{ 
        maxWidth: showPreview ? '90vw' : '800px',
        display: 'flex',
        transition: 'all 0.3s ease'
      }}>
        {/* Main Form */}
        <div style={{ 
          flex: showPreview ? '0 0 60%' : '1',
          paddingRight: showPreview ? '2rem' : '0',
          borderRight: showPreview ? '1px solid #e5e7eb' : 'none'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '600' }}>{editingFeed ? 'Edit Export Feed' : 'Create Export Feed'}</h3>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Basic Settings */}
            <div className="form-section">
              <h4 style={{ fontSize: '1.125rem', fontWeight: '500', marginBottom: '1rem', color: '#374151' }}>Basic Settings</h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input
                    className="form-input-large"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="My Export Feed"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Source Feed</label>
                  <select
                    className="form-input-large"
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
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Pricing Multiplier</label>
                  <input
                    className="form-input-large"
                    type="number"
                    step="0.01"
                    value={formData.pricingMultiplier}
                    onChange={(e) => setFormData({ ...formData, pricingMultiplier: parseFloat(e.target.value) || 1 })}
                    placeholder="1.0"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Maximum Items</label>
                  <input
                    className="form-input-large"
                    type="number"
                    value={formData.maxItems}
                    onChange={(e) => setFormData({ ...formData, maxItems: e.target.value })}
                    placeholder="No limit"
                  />
                </div>
              </div>
            </div>

            {/* Advanced Filters */}
            <div className="form-section">
              <h4 style={{ fontSize: '1.125rem', fontWeight: '500', marginBottom: '1rem', color: '#374151' }}>Advanced Filters</h4>
              
              {/* Brand Filter */}
              <div className="form-group">
                <label className="form-label">Brands</label>
                <div className="filter-search-container">
                  <input
                    className="form-input-large"
                    type="text"
                    value={searchTerms.brand}
                    onChange={(e) => setSearchTerms({ ...searchTerms, brand: e.target.value })}
                    placeholder="Search brands..."
                  />
                  <div className="filter-options">
                    {getFilteredOptions(brands, searchTerms.brand).slice(0, 10).map(brand => (
                      <button
                        key={brand}
                        type="button"
                        className="filter-option-btn"
                        onClick={() => addToFilter('brands', brand)}
                        disabled={formData.filters.brands.includes(brand)}
                      >
                        {brand}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="selected-filters">
                  {formData.filters.brands.map(brand => (
                    <span key={brand} className="filter-tag">
                      {brand}
                      <button type="button" onClick={() => removeFromFilter('brands', brand)}>×</button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Original Categories */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Include Categories</label>
                  <div className="filter-search-container">
                    <input
                      className="form-input-large"
                      type="text"
                      value={searchTerms.originalCategory}
                      onChange={(e) => setSearchTerms({ ...searchTerms, originalCategory: e.target.value })}
                      placeholder="Search categories..."
                    />
                    <div className="filter-options">
                      {getFilteredOptions(originalCategories, searchTerms.originalCategory).slice(0, 10).map(category => (
                        <button
                          key={category}
                          type="button"
                          className="filter-option-btn"
                          onClick={() => addToFilter('includeCategories', category)}
                          disabled={formData.filters.includeCategories.includes(category)}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="selected-filters">
                    {formData.filters.includeCategories.map(category => (
                      <span key={category} className="filter-tag filter-tag-include">
                        {category}
                        <button type="button" onClick={() => removeFromFilter('includeCategories', category)}>×</button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Exclude Categories</label>
                  <div className="filter-search-container">
                    <input
                      className="form-input-large"
                      type="text"
                      value={searchTerms.originalCategory}
                      onChange={(e) => setSearchTerms({ ...searchTerms, originalCategory: e.target.value })}
                      placeholder="Search categories..."
                    />
                    <div className="filter-options">
                      {getFilteredOptions(originalCategories, searchTerms.originalCategory).slice(0, 10).map(category => (
                        <button
                          key={category}
                          type="button"
                          className="filter-option-btn"
                          onClick={() => addToFilter('excludeCategories', category)}
                          disabled={formData.filters.excludeCategories.includes(category)}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="selected-filters">
                    {formData.filters.excludeCategories.map(category => (
                      <span key={category} className="filter-tag filter-tag-exclude">
                        {category}
                        <button type="button" onClick={() => removeFromFilter('excludeCategories', category)}>×</button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* eMAG Categories */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Include eMAG Categories</label>
                  <div className="filter-search-container">
                    <input
                      className="form-input-large"
                      type="text"
                      value={searchTerms.emagCategory}
                      onChange={(e) => setSearchTerms({ ...searchTerms, emagCategory: e.target.value })}
                      placeholder="Search eMAG categories..."
                    />
                    <div className="filter-options">
                      {getFilteredOptions(emagCategories.map(cat => cat.title), searchTerms.emagCategory).slice(0, 10).map(category => (
                        <button
                          key={category}
                          type="button"
                          className="filter-option-btn"
                          onClick={() => addToFilter('includeEmagCategories', category)}
                          disabled={formData.filters.includeEmagCategories.includes(category)}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="selected-filters">
                    {formData.filters.includeEmagCategories.map(category => (
                      <span key={category} className="filter-tag filter-tag-include">
                        {category}
                        <button type="button" onClick={() => removeFromFilter('includeEmagCategories', category)}>×</button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Exclude eMAG Categories</label>
                  <div className="filter-search-container">
                    <input
                      className="form-input-large"
                      type="text"
                      value={searchTerms.emagCategory}
                      onChange={(e) => setSearchTerms({ ...searchTerms, emagCategory: e.target.value })}
                      placeholder="Search eMAG categories..."
                    />
                    <div className="filter-options">
                      {getFilteredOptions(emagCategories.map(cat => cat.title), searchTerms.emagCategory).slice(0, 10).map(category => (
                        <button
                          key={category}
                          type="button"
                          className="filter-option-btn"
                          onClick={() => addToFilter('excludeEmagCategories', category)}
                          disabled={formData.filters.excludeEmagCategories.includes(category)}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="selected-filters">
                    {formData.filters.excludeEmagCategories.map(category => (
                      <span key={category} className="filter-tag filter-tag-exclude">
                        {category}
                        <button type="button" onClick={() => removeFromFilter('excludeEmagCategories', category)}>×</button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Product Count Display */}
            <div className="product-count-display">
              <span style={{ fontSize: '1.125rem', fontWeight: '500', color: '#374151' }}>
                Products matching filters: <strong style={{ color: '#059669' }}>{productCount.toLocaleString()}</strong>
              </span>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
              <button 
                type="button" 
                onClick={loadPreview}
                disabled={loadingPreview || productCount === 0}
                className="btn btn-outline"
              >
                {loadingPreview ? 'Loading...' : 'Preview Products'}
              </button>
              
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" onClick={onClose} className="btn btn-secondary-large">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary-large">
                  {loading ? 'Saving...' : (editingFeed ? 'Update Feed' : 'Create Feed')}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Preview Panel */}
        {showPreview && (
          <div style={{ flex: '0 0 40%', paddingLeft: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '1.125rem', fontWeight: '500', color: '#374151' }}>Preview Products</h4>
              <button 
                type="button" 
                onClick={() => setShowPreview(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            
            <div className="preview-products" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {previewProducts.map((product, index) => (
                <div key={product.id} className="preview-product-card">
                  <div style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>
                    {product.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    {product.brand} • {product.price_b2c || product.price} {product.currency || 'RON'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    Categories: {(product.originalCategories || []).join(', ')}
                  </div>
                  {product.emagCategory && (
                    <div style={{ fontSize: '0.75rem', color: '#059669' }}>
                      eMAG: {product.emagCategory}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}