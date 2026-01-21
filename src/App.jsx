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
  const [lastUpdated, setLastUpdated] = useState(null);

  // Load prices from API on mount
  useEffect(() => {
    async function loadPrices() {
      setLoading(true);
      try {
        const data = await fetchPricesFromAPI();
        setPriceData(data);
        setLastUpdated(data.lastUpdated);
      } catch (error) {
        console.error('Error loading prices:', error);
      } finally {
        setLoading(false);
      }
    }

    loadPrices();

    // Refresh prices every 5 minutes
    const interval = setInterval(loadPrices, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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
                <span className="rate-text">
                  CNY/USD rate: <span className="rate-value">{conversionRate.toFixed(4)}</span>
                  {' '}• Updated: <span className="rate-value">{formatLastUpdated(lastUpdated)}</span>
                </span>
              </div>
            </>
          ) : (
            <div className="spot-only-notice">
              <div className="notice-icon">ⓘ</div>
              <div className="notice-title">Spot Only Asset</div>
              <p className="notice-text">
                Spodumene concentrate pricing is currently restricted to physical spot settlements.
                <br />
                No active futures derivatives are listed for this grade on GFEX.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
