import React from 'react';

function ContractsTable({ contracts }) {
    const formatPrice = (price) => {
        return new Intl.NumberFormat('en-US').format(price);
    };

    const formatChange = (change) => {
        // Handle null/undefined - show N/A
        if (change === null || change === undefined) {
            return 'N/A';
        }
        if (change === 0) return '0.00%';
        const sign = change >= 0 ? '+' : '';
        return `${sign}${change.toFixed(2)}%`;
    };

    const getChangeClass = (change) => {
        if (change === null || change === undefined) return 'neutral';
        if (change > 0) return 'positive';
        if (change < 0) return 'negative';
        return 'neutral';
    };

    return (
        <div className="contracts-section">
            <div className="contracts-header">
                <h3 className="contracts-title">
                    <span className="contracts-icon"></span>
                    Market Contracts
                </h3>
                <span className="contracts-subtitle">Official Settlement</span>
            </div>

            <div className="contracts-table">
                <div className="table-header">
                    <span>Maturity / Contract</span>
                    <span>Price / 24H Change</span>
                </div>

                {contracts.map((contract) => (
                    <div
                        key={contract.contract}
                        className={`contract-row ${contract.isSpot ? 'spot-row' : ''}`}
                    >
                        <div className="contract-info">
                            <span className={`contract-dot ${contract.isSpot ? 'spot' : ''}`}></span>
                            <div className="contract-details">
                                <span className={`contract-month ${contract.isSpot ? 'spot' : ''}`}>
                                    {contract.month}
                                </span>
                                <span className="contract-type">{contract.type}</span>
                            </div>
                        </div>

                        <div className="contract-price-info">
                            <div className="contract-price">${formatPrice(contract.price)}</div>
                            <div className={`contract-change ${getChangeClass(contract.change)}`}>
                                {formatChange(contract.change)} {contract.change !== null ? 'vs yesterday' : ''}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default ContractsTable;
