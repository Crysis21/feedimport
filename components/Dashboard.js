import { useState, useEffect } from 'react';

export default function Dashboard({ user }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    brand: '',
    feedId: '',
    categoryProcessed: ''
  });
  const [brands, setBrands] = useState([]);
  const [feeds, setFeeds] = useState([]);
  const [processingStats, setProcessingStats] = useState({ processed: 0, unprocessed: 0, total: 0 });
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (user?.uid) {
      fetchProducts();
    }
  }, [user, filters]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        userId: user.uid,
        ...filters
      });

      const response = await fetch(`/api/dashboard/products?${params}`);
      const data = await response.json();

      if (response.ok) {
        setProducts(data.products || []);
        setBrands(data.brands || []);
        setFeeds(data.feeds || []);
        setProcessingStats(data.processingStats || { processed: 0, unprocessed: 0, total: 0 });
        setTotal(data.total || 0);
      } else {
        console.error('Failed to fetch products:', data.error);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      brand: '',
      feedId: '',
      categoryProcessed: ''
    });
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      return new Date(date.seconds * 1000).toLocaleDateString();
    } catch {
      return new Date(date).toLocaleDateString();
    }
  };

  const getStatusBadge = (product) => {
    if (product.categoryProcessed) {
      return (
        <span className="status-badge processed">
          ✅ Processed
        </span>
      );
    } else {
      return (
        <span className="status-badge unprocessed">
          ⏳ Pending
        </span>
      );
    }
  };

  const getCategoryDisplay = (product) => {
    if (product.emagCategory) {
      return (
        <div className="category-info">
          <div className="emag-category">
            <strong>{product.emagCategory}</strong>
          </div>
          {product.emagCategoryPath && (
            <div className="category-path">
              {product.emagCategoryPath}
            </div>
          )}
        </div>
      );
    }
    return <span className="no-category">No eMAG category</span>;
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Products Dashboard</h2>
        <div className="stats-overview">
          <div className="stat-card">
            <div className="stat-number">{total}</div>
            <div className="stat-label">Total Products</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{processingStats.processed}</div>
            <div className="stat-label">Processed</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{processingStats.unprocessed}</div>
            <div className="stat-label">Pending</div>
          </div>
        </div>
      </div>

      <div className="filters-section">
        <div className="filters-row">
          <div className="filter-group">
            <label>Search Products</label>
            <input
              type="text"
              placeholder="Search by name, brand, or category..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>Brand</label>
            <select
              value={filters.brand}
              onChange={(e) => handleFilterChange('brand', e.target.value)}
              className="filter-select"
            >
              <option value="">All Brands</option>
              {brands.map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Feed Source</label>
            <select
              value={filters.feedId}
              onChange={(e) => handleFilterChange('feedId', e.target.value)}
              className="filter-select"
            >
              <option value="">All Feeds</option>
              {feeds.map(feed => (
                <option key={feed.id} value={feed.id}>{feed.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Status</label>
            <select
              value={filters.categoryProcessed}
              onChange={(e) => handleFilterChange('categoryProcessed', e.target.value)}
              className="filter-select"
            >
              <option value="">All Status</option>
              <option value="true">Processed</option>
              <option value="false">Pending</option>
            </select>
          </div>

          <div className="filter-actions">
            <button onClick={clearFilters} className="btn btn-secondary">
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading products...</p>
        </div>
      ) : (
        <div className="products-section">
          <div className="products-header">
            <h3>Products ({total})</h3>
          </div>

          {products.length === 0 ? (
            <div className="no-products">
              <p>No products found matching your criteria.</p>
            </div>
          ) : (
            <div className="products-table">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Brand</th>
                    <th>Feed</th>
                    <th>eMAG Category</th>
                    <th>Status</th>
                    <th>Price</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(product => (
                    <tr key={product.id}>
                      <td>
                        <div className="product-info">
                          <div className="product-title">{product.title}</div>
                          <div className="product-sku">SKU: {product.sku}</div>
                          {product.originalCategories && product.originalCategories.length > 0 && (
                            <div className="original-categories">
                              {product.originalCategories.join(', ')}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>{product.brand || 'N/A'}</td>
                      <td>
                        {feeds.find(f => f.id === product.feedId)?.name || product.feedId}
                      </td>
                      <td>{getCategoryDisplay(product)}</td>
                      <td>{getStatusBadge(product)}</td>
                      <td>{product.price || 'N/A'}</td>
                      <td>{formatDate(product.lastUpdated)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .dashboard {
          max-width: 1200px;
          margin: 0 auto;
          padding: 1rem;
        }

        .dashboard-header {
          margin-bottom: 2rem;
        }

        .dashboard-header h2 {
          margin: 0 0 1rem 0;
          color: #1f2937;
        }

        .stats-overview {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .stat-card {
          background: #f8fafc;
          padding: 1rem;
          border-radius: 8px;
          text-align: center;
          min-width: 120px;
        }

        .stat-number {
          font-size: 2rem;
          font-weight: bold;
          color: #3b82f6;
        }

        .stat-label {
          font-size: 0.875rem;
          color: #6b7280;
          margin-top: 0.25rem;
        }

        .filters-section {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          margin-bottom: 2rem;
        }

        .filters-row {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          align-items: end;
        }

        .filter-group {
          flex: 1;
          min-width: 200px;
        }

        .filter-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: #374151;
        }

        .filter-input,
        .filter-select {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.875rem;
        }

        .filter-actions {
          display: flex;
          align-items: end;
        }

        .products-section {
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .products-header {
          padding: 1.5rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .products-header h3 {
          margin: 0;
          color: #1f2937;
        }

        .products-table {
          overflow-x: auto;
        }

        .products-table table {
          width: 100%;
          border-collapse: collapse;
        }

        .products-table th,
        .products-table td {
          padding: 1rem;
          text-align: left;
          border-bottom: 1px solid #e5e7eb;
        }

        .products-table th {
          background: #f9fafb;
          font-weight: 600;
          color: #374151;
          font-size: 0.875rem;
        }

        .product-info {
          max-width: 300px;
        }

        .product-title {
          font-weight: 500;
          color: #1f2937;
          margin-bottom: 0.25rem;
        }

        .product-sku {
          font-size: 0.75rem;
          color: #6b7280;
          margin-bottom: 0.25rem;
        }

        .original-categories {
          font-size: 0.75rem;
          color: #6b7280;
          font-style: italic;
        }

        .category-info {
          max-width: 200px;
        }

        .emag-category {
          color: #059669;
          margin-bottom: 0.25rem;
        }

        .category-path {
          font-size: 0.75rem;
          color: #6b7280;
        }

        .no-category {
          color: #6b7280;
          font-style: italic;
        }

        .status-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .status-badge.processed {
          background: #d1fae5;
          color: #065f46;
        }

        .status-badge.unprocessed {
          background: #fef3c7;
          color: #92400e;
        }

        .loading {
          text-align: center;
          padding: 3rem;
        }

        .spinner {
          border: 4px solid #f3f4f6;
          border-top: 4px solid #3b82f6;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem auto;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .no-products {
          text-align: center;
          padding: 3rem;
          color: #6b7280;
        }

        .btn {
          padding: 0.75rem 1rem;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
        }

        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
        }

        .btn-secondary:hover {
          background: #e5e7eb;
        }

        @media (max-width: 768px) {
          .filters-row {
            flex-direction: column;
          }

          .filter-group {
            min-width: 100%;
          }

          .products-table {
            font-size: 0.875rem;
          }

          .products-table th,
          .products-table td {
            padding: 0.75rem 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}