export type SwapData =  {
  price: number;
  cumulativeSpent: number;
  reserveModelToken: number;
  reserveAssetToken: number;
}

export function extractSwapDataFromText(text:string){
  const priceRegex = /InternalSwap price \d+ ([0-9.]+)/g;
  const spentRegex = /Spent asset token amount \d+ (\d+)/g;
  const reserveRegex = /quality of intenalswap modelToken \d+ (\d+)/g;
  const uniswapPriceRegex = /uniswap price (\d+(?:\.\d+)?)/gi;
  const reserveAssetRegex = /quality of intenalswap asset \d+ (\d+)/g;
  const buyTaxRegex = /InternalSwap buy tax:\s*([0-9.]+)/g;
  const sellTaxRegex = /InternalSwap sell tax:\s*([0-9.]+)/g;

  const prices = [];
  const spent = [];
  const reserve = [];
  const uniswapPrice = [];
  const reserveAsset = [];
  const buyTax = [];
  const sellTax = [];

  let match;

  // 提取价格
  while ((match = priceRegex.exec(text)) !== null) {
    prices.push(parseFloat(match[1]));
  }

  while ((match = spentRegex.exec(text)) !== null) {
    spent.push(parseInt(match[1]));
  }

  while ((match = reserveRegex.exec(text)) !== null) {
    reserve.push(parseInt(match[1]));
  }

  while ((match = uniswapPriceRegex.exec(text)) !== null) {
    uniswapPrice.push(parseFloat(match[1]));
  }

  while ((match = reserveAssetRegex.exec(text)) !== null) {
    reserveAsset.push(parseInt(match[1]));
  }

  while ((match = buyTaxRegex.exec(text)) !== null) {
    buyTax.push(parseFloat(match[1]));
  }

  while ((match = sellTaxRegex.exec(text)) !== null) {
    sellTax.push(parseFloat(match[1]));
  }

  const minLength = Math.min(prices.length, spent.length);
  const result: SwapData[] = [];

  let cumulativeSpent = 0;
  for (let i = 0; i < minLength; i++) {
    cumulativeSpent += spent[i];
    result.push({
      cumulativeSpent: cumulativeSpent,
      reserveModelToken: reserve[i],
      price: prices[i],
      reserveAssetToken: reserveAsset[i],
    });
  }

  return {result, uniswapPrice:uniswapPrice[0], buyTax:buyTax[0], sellTax:sellTax[0]};
}