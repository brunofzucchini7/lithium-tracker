import React from 'react';

function PriceDisplay({ product }) {
    const hasChange = product.change !== null && product.change !== undefined;
    const isPositive = hasChange && product.change >= 0;

    const formatPrice = (price) => {
        return new Intl.NumberFormat('en-US').format(price);
    };

    const formatChange = (change) => {
        if (change === null || change === undefined) return 'N/A';
        const sign = change >= 0 ? '+' : '';
        return `${sign}$${formatPrice(Math.abs(change))}`;
    };

    const formatPercent = (percent) => {
        if (percent === null || percent === undefined) return 'N/A';
        const sign = percent >= 0 ? '+' : '';
        return `${sign}${percent.toFixed(2)}%`;
    };

    return (
        <div className="price-display">
            <h2 className="product-title">
                {product.name} <span className="grade">{product.grade}</span>
            </h2>

            <div className="main-price">
                <span className="price-value">${formatPrice(product.price)}</span>
                <span className="price-unit">{product.unit}</span>
            </div>

            <div className="variation-container">
                <div className="variation-pill">
                    <span className="variation-label">Variation Today</span>
                    {hasChange ? (
                        <>
                            <span className={`variation-value ${isPositive ? 'positive' : 'negative'}`}>
                                <span className="variation-arrow">{isPositive ? '↗' : '↘'}</span>
                                {formatChange(product.change)}
                            </span>
                            <span className={`variation-percent ${isPositive ? 'positive' : 'negative'}`}>
                                {formatPercent(product.changePercent)}
                            </span>
                        </>
                    ) : (
                        <span className="variation-value neutral">
                            No previous data
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PriceDisplay;
