import React, { useState, useEffect, useMemo } from 'react';
import PriceDisplay from './components/PriceDisplay';
import FuturesCurve from './components/FuturesCurve';
import ContractsTable from './components/ContractsTable';
import {
  fetchPricesFromAPI,
  getSpotPrices,
  getConversionRate,
  getFuturesContractsUSD,
  getChartData,
  formatLastUpdated,
  defaultData,
} from './data/lithiumData';

function App() {
  const [activeTab, setActiveTab] = useState('carbonate');
  const [priceData, setPriceData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  async function loadPrices() {
    try {
      const data = await fetchPricesFromAPI();
      setPriceData(data);
      setLastUpdated(data.lastUpdated);
    } catch (error) {
      console.error('Error loading prices:', error);
    }
  }

  // Load prices from API on mount
  useEffect(() => {
    async function init() {
      setLoading(true);
      await loadPrices();
      setLoading(false);
    }
    init();

    // Refresh prices every 5 minutes
    const interval = setInterval(loadPrices, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPrices();
    // Small delay for visual feedback if refresh is too fast
    setTimeout(() => setRefreshing(false), 800);
  };

  // Get spot prices
  const spotPrices = useMemo(() => getSpotPrices(priceData), [priceData]);

  // Calculate conversion rate
  const conversionRate = useMemo(() => getConversionRate(priceData), [priceData]);

  // Get futures contracts in USD
  const futuresContracts = useMemo(() =>
    getFuturesContractsUSD(priceData), [priceData]
  );

  // Get chart data
  const chartData = useMemo(() =>
    getChartData(priceData), [priceData]
  );

  const currentProduct = spotPrices[activeTab];

  return (
    <div className="app">
      {/* Tab Switcher */}
      <div className="tab-switcher">
        <div className="tab-container">
          <button
            className={`tab-btn ${activeTab === 'carbonate' ? 'active' : ''}`}
            onClick={() => setActiveTab('carbonate')}
          >
            Carbonate
          </button>
          <button
            className={`tab-btn ${activeTab === 'spodumene' ? 'active' : ''}`}
            onClick={() => setActiveTab('spodumene')}
          >
            Spodumene
          </button>
        </div>
      </div>

      {/* Market Badge */}
      <div className="market-badge">
        <div className="badge">
          <span className="badge-dot"></span>
          SMM SPOT MARKET
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="price-display">
          <div className="loading-text">Loading prices...</div>
        </div>
      ) : (
        <>
          {/* Price Display */}
          <PriceDisplay product={currentProduct} />

          {/* Show futures curve only for Carbonate, spot notice for Spodumene */}
          {activeTab === 'carbonate' ? (
            <>
              <FuturesCurve chartData={chartData} />
              <ContractsTable contracts={futuresContracts} />

              {/* Conversion Rate & Last Updated Info */}
              <div className="conversion-rate">
                <div className="update-info">
                  <span className="rate-text">
                    CNY/USD: <span className="rate-value">{conversionRate.toFixed(4)}</span>
                    {' '}• Updated: <span className="rate-value">{formatLastUpdated(lastUpdated)}</span>
                  </span>
                  <button
                    className={`refresh-btn ${refreshing ? 'loading' : ''}`}
                    onClick={handleRefresh}
                    disabled={refreshing}
                    title="Refresh Prices"
                  >
                    <svg className="refresh-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C14.5074 3 16.7793 4.02456 18.4063 5.67104M21 12V7M21 12H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="spot-only-notice">
                <div className="notice-icon">ⓘ</div>
                <div className="notice-title">Spot Only Asset</div>
                <p className="notice-text">
                  Spodumene concentrate pricing is currently restricted to physical spot settlements.
                  <br />
                  No active futures derivatives are listed for this grade on GFEX.
                </p>
              </div>

              {/* Add refresh button here too for consistency */}
              <div className="conversion-rate">
                <div className="update-info">
                  <span className="rate-text">
                    Updated: <span className="rate-value">{formatLastUpdated(lastUpdated)}</span>
                  </span>
                  <button
                    className={`refresh-btn ${refreshing ? 'loading' : ''}`}
                    onClick={handleRefresh}
                    disabled={refreshing}
                    title="Refresh Prices"
                  >
                    <svg className="refresh-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C14.5074 3 16.7793 4.02456 18.4063 5.67104M21 12V7M21 12H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default App;
