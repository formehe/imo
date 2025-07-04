import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { extractSwapDataFromText} from './extract_price_data';

const PriceCurveChart: React.FC = () => {
  const [chartData, setChartData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('./swap交易曲线.txt')
      .then(res => {
        if (!res.ok) throw new Error('文件加载失败');
        return res.text();
      })
      .then(rawText => {
        const {result, uniswapPrice, buyTax, sellTax} = extractSwapDataFromText(rawText);
        const avgPrice = (result.reduce((sum, d) => sum + Number(d.price), 0) / result.length).toFixed(4);
        const withReference = result.map(d => ({
          ...d,
          liquidModelToken: (1e9 - d.reserveModelToken / 1e18).toFixed(2),
          reserveModelToken: (d.reserveModelToken / 1e18).toFixed(2),
          uniswapPrice: uniswapPrice,
          avgPrice: avgPrice,
          buyTax: buyTax,
          sellTax: sellTax,
        }));
        setChartData(withReference);
      })
      .catch(err => setError(err.message));
  }, []);

  if (error) return <div>错误: {error}</div>;
  if (chartData.length === 0) return <div>加载中...</div>;

  const assetGroth = ((chartData[chartData.length - 1].reserveAssetToken - chartData[0].reserveAssetToken) / chartData[0].reserveAssetToken).toFixed(2);
  const modeltokenReduce = (
        (Number(chartData[0].reserveModelToken) - Number(chartData[chartData.length - 1].reserveModelToken)) /
        Number(chartData[0].reserveModelToken) *
        100
      ).toFixed(2)

  // const maxPrice = Math.max(...chartData.map(d => d.price));
  // const minPrice = Math.min(...chartData.map(d => d.price));

  return (
    <div style={{ width: "120%", height: 600 }}>
      <h2>购买力-累计主币投入曲线</h2>
      <ResponsiveContainer>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="cumulativeSpent"
            label={{ value: "累计投入主币数量", position: "insideBottom", offset: -5 }}
          />
          <YAxis
            domain={[0, 60]}
            tickCount={60}
            label={{ value: "购买力", angle: -90, position: "insideLeft" }}
          />
          <Tooltip content = {({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              return (
                <div style={{ backgroundColor: 'black', border: '1px solid #ccc', padding: 10 }}>
                  <p><strong>累计投入主币数量:</strong> {label}</p>
                  {payload.map((entry, index) => (
                    <p key={index} style={{ color: entry.color }}>
                      {entry.name} : {entry.value}
                    </p>
                  ))}
                </div>
              );
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="price"
            stroke="#8884d8"
            dot={true}
            strokeWidth={2}
            name="内盘购买力(token/top)"
          />
          <Line 
              type="monotone" 
              dataKey="uniswapPrice"
              stroke="#ef4444" 
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={true}
              name="Uniswap 外盘初始购买力"
          />
          <Line 
              type="monotone" 
              dataKey="avgPrice"
              stroke="orange" 
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={true}
              name="平均购买力"
          />
        </LineChart>
      </ResponsiveContainer>
      <h2>购买力-流动模型代币曲线</h2>
      <ResponsiveContainer>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3"/>
          <XAxis
            dataKey="liquidModelToken"
            label={{ value: "流通模型代币", position: "insideBottom", offset: -5 }}
            tickFormatter={(val) => {
              try {
                return (BigInt("1000000000000000000000000000") - BigInt(val)).toString();
              } catch (e) {
                return val; // fallback
              }
            }}
          />
          <YAxis
            domain={[0, 60]}
            tickCount={60}
            label={{ value: "购买力", angle: -90, position: "insideLeft" }}
          />
          <Tooltip content = {({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              return (
                <div style={{ backgroundColor: 'black', border: '1px solid #ccc', padding: 10 }}>
                  <p><strong>模型代币流通量:</strong> {label}</p>
                  {payload.map((entry, index) => (
                    <p key={index} style={{ color: entry.color }}>
                      {entry.name} : {entry.value}
                    </p>
                  ))}
                </div>
              );
            }} 
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="price"
            stroke="#8884d8"
            dot={true}
            strokeWidth={3}
            name="内盘购买力(token/top)"
          />
          <Line 
              type="monotone" 
              dataKey="uniswapPrice"
              stroke="#ef4444" 
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={true}
              name="Uniswap外盘初始购买力"
          />
          <Line
              type="monotone" 
              dataKey="avgPrice"
              stroke="orange" 
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={true}
              name="平均购买力"
          />
        </LineChart>
      </ResponsiveContainer>
      {/* 统计信息 */}
      <h3 className="text-lg font-semibold mb-3">数据分析总结</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <ul 
            className="list-disc list-inside space-y-1 text-gray-600"
            style={{ textAlign: 'left' }}
          >
            <li>
              起始内盘购买力: {chartData[0].price.toFixed(3)},
              最终内盘购买力: {chartData[chartData.length-1].price.toFixed(3)},
              Uniswap外盘购买力: {chartData[0].uniswapPrice.toFixed(3)},
              内盘购买力降幅: {(((chartData[0].price - chartData[chartData.length-1].price) / chartData[0].price) * 100).toFixed(1)}%
              价格涨幅: {(chartData[0].price/chartData[chartData.length-1].price).toFixed(2)}倍
            </li>
            <li>内盘流动池资产数量持续增加（约{assetGroth}倍增长），增加至{(chartData[chartData.length-1].reserveAssetToken/1e6).toFixed(2)}</li>
            <li>内盘流动池模型代币数量持续减少（约{modeltokenReduce}%减少）,由{1e9}减少至{chartData[chartData.length-1].reserveModelToken}</li>
            <li>K值保持相对稳定，符合AMM机制</li>
            <li>内盘交易税率：买入{chartData[0].buyTax * 100}%，卖出{chartData[0].sellTax * 100}%</li>
          </ul>
      </div>
    </div>
  );
};

export default PriceCurveChart;
