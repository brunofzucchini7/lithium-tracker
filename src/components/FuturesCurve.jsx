import React, { useRef } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Filler
);

function FuturesCurve({ chartData }) {
    const chartRef = useRef(null);

    const labels = chartData.map(d => d.label);
    const prices = chartData.map(d => d.price);

    const data = {
        labels,
        datasets: [
            {
                label: 'Price (USD/mt)',
                data: prices,
                borderColor: '#00DC82',
                borderWidth: 2,
                borderDash: [6, 4],
                backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 280);
                    gradient.addColorStop(0, 'rgba(0, 220, 130, 0.25)');
                    gradient.addColorStop(0.5, 'rgba(0, 220, 130, 0.08)');
                    gradient.addColorStop(1, 'rgba(0, 220, 130, 0)');
                    return gradient;
                },
                fill: true,
                tension: 0.4,
                pointRadius: (context) => {
                    // Larger point for spot price
                    return context.dataIndex === 0 ? 8 : 0;
                },
                pointHoverRadius: 6,
                pointBackgroundColor: '#00DC82',
                pointBorderColor: '#00DC82',
                pointBorderWidth: 0,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                backgroundColor: '#1A1A1A',
                titleColor: '#FFFFFF',
                bodyColor: '#888888',
                borderColor: '#2A2A2A',
                borderWidth: 1,
                padding: 12,
                displayColors: false,
                callbacks: {
                    title: (items) => items[0].label,
                    label: (item) => `$${item.raw.toLocaleString()} USD/mt`,
                },
            },
        },
        scales: {
            x: {
                grid: {
                    display: false,
                },
                ticks: {
                    color: '#555555',
                    font: {
                        size: 11,
                        weight: 500,
                    },
                },
                border: {
                    display: false,
                },
            },
            y: {
                position: 'right',
                grid: {
                    color: 'rgba(42, 42, 42, 0.5)',
                    drawBorder: false,
                },
                ticks: {
                    color: '#555555',
                    font: {
                        size: 11,
                    },
                    callback: (value) => `$${(value / 1000).toFixed(0)},000`,
                },
                border: {
                    display: false,
                },
            },
        },
    };

    return (
        <div className="futures-section">
            <div className="futures-header">
                <div>
                    <h2 className="futures-title">GFEX Futures Curve</h2>
                    <p className="futures-subtitle">Physical Spot to Maturity Projection</p>
                </div>
                <div className="chart-legend">
                    <div className="legend-item">
                        <span className="legend-dot"></span>
                        <span>Spot</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-line"></span>
                        <span>Futures</span>
                    </div>
                </div>
            </div>
            <div className="chart-container">
                <Line ref={chartRef} data={data} options={options} />
            </div>
        </div>
    );
}

export default FuturesCurve;
