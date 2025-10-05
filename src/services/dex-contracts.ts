export const KNOWN_ROUTERS: Record<string, { name: string; chain: string }> = {
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': {
    name: 'Uniswap V2 Router',
    chain: 'ethereum',
  },
  '0xe592427a0aece92de3edee1f18e0157c05861564': {
    name: 'Uniswap V3 Router',
    chain: 'ethereum',
  },
  '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': {
    name: 'Uniswap Universal Router',
    chain: 'ethereum',
  },
  '0x10ed43c718714eb63d5aa57b78b54704e256024e': {
    name: 'PancakeSwap Router',
    chain: 'bsc',
  },
  '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506': {
    name: 'SushiSwap Router',
    chain: 'ethereum',
  },
};

export const METHOD_SIGNATURES: Record<string, { name: string; type: string }> = {
  '0x60806040': { name: 'Contract Creation', type: 'contract_deploy' },
  '0xf305d719': { name: 'addLiquidityETH', type: 'add_liquidity' },
  '0xe8e33700': { name: 'addLiquidity', type: 'add_liquidity' },
  '0x4bb278f3': { name: 'addLiquidityAVAX', type: 'add_liquidity' },
  '0x7ff36ab5': { name: 'swapExactETHForTokens', type: 'swap' },
  '0x18cbafe5': { name: 'swapExactTokensForETH', type: 'swap' },
  '0x38ed1739': { name: 'swapExactTokensForTokens', type: 'swap' },
  '0x8803dbee': { name: 'swapTokensForExactTokens', type: 'swap' },
  '0xfb3bdb41': { name: 'swapETHForExactTokens', type: 'swap' },
  '0x5c11d795': { name: 'swapExactTokensForTokensSupportingFeeOnTransferTokens', type: 'swap' },
  '0xb6f9de95': { name: 'swapExactETHForTokensSupportingFeeOnTransferTokens', type: 'swap' },
  '0xa9059cbb': { name: 'transfer', type: 'token_transfer' },
  '0x23b872dd': { name: 'transferFrom', type: 'token_transfer' },
  '0x095ea7b3': { name: 'approve', type: 'token_approval' },
  '0x40c10f19': { name: 'mint', type: 'token_mint' },
  '0x1698ee82': { name: 'createPair', type: 'create_pair' },
};

export const FACTORY_ADDRESSES: Record<string, string> = {
  '0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f': 'Uniswap V2 Factory',
  '0x1f98431c8ad98523631ae4a59f267346ea31f984': 'Uniswap V3 Factory',
  '0xca143ce32fe78f1f7019d7d551a6402fc5350c73': 'PancakeSwap Factory',
  '0xc35dadb65012ec5796536bd9864ed8773abc74c4': 'SushiSwap Factory',
};
