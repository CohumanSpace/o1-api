---
name: "o1.exchange Trading API"
description: "Execute trades on o1.exchange with MEV protection, gasless approvals, and multi-network support for Base and BSC"
version: "1.0.0"
author: "o1.exchange"
tags: ["trading", "defi", "blockchain", "api", "crypto"]
---

# o1.exchange Trading API Skill

This skill enables Claude Code to interact with the o1.exchange trading API to execute buy/sell orders on supported blockchain networks with enterprise-grade features.

## Features

- **Multi-Network Support**: Trade on Base (ETH) and BSC (BNB) networks
- **MEV Protection**: Built-in sandwich attack prevention through private mempool routing
- **Gasless Approvals**: One-time Permit2 signatures for unlimited trading
- **Automatic Slippage Protection**: Customizable slippage limits
- **Real-time Balance Tracking**: Pre and post-trade balance monitoring
- **Interactive CLI**: User-friendly command-line interface

## Prerequisites

### Environment Variables

Create a `.env.local` file with the following required variables:

```env
EXECUTE_TRADE_PRIVATE_KEY=your_wallet_private_key_here
EXECUTE_TRADE_API_TOKEN=your_o1_exchange_api_token_here
EXECUTE_TRADE_BASE_URL=https://api.o1.exchange
EXECUTE_TRADE_BASE_RPC_URL=your_base_rpc_url_here
EXECUTE_TRADE_BSC_RPC_URL=your_bsc_rpc_url_here
```

### Dependencies

Ensure these npm packages are installed:
- `axios` - HTTP client for API calls
- `ethers` - Ethereum library for blockchain interactions
- `dotenv` - Environment variable management
- `readline` - Interactive CLI input handling

## API Endpoints

### Create Order
- **Endpoint**: `POST /api/v2/order`
- **Purpose**: Create a new trading order
- **Parameters**:
  - `signerAddress`: Wallet address for signing transactions
  - `tokenAddress`: ERC-20 token contract address
  - `uiAmount`: Amount in human-readable format
  - `direction`: "buy" or "sell"
  - `slippageBps`: Slippage tolerance in basis points (default: 300 = 3%)
  - `mevProtection`: Boolean for MEV protection (recommended: true)
  - `networkId`: Network chain ID (8453 for Base, 56 for BSC)

### Complete Order
- **Endpoint**: `POST /api/v2/order/complete`
- **Purpose**: Submit signed transactions to complete the order
- **Parameters**:
  - `id`: Order ID from create order response
  - `transactions`: Array of signed transaction objects

## Usage Examples

### Basic Trade Execution

```javascript
// Create order
const orderResponse = await axios.post(`${BASE_URL}/api/v2/order`, {
  signerAddress: wallet.address,
  tokenAddress: "0x1111111111166b7fe7bd91427724b487980afc69", // Example: Zora on Base
  uiAmount: "0.1",
  direction: "buy",
  slippageBps: 300,
  mevProtection: true,
  networkId: 8453 // Base
}, {
  headers: { Authorization: `Bearer ${API_TOKEN}` }
});

// Sign and submit transactions
const signedTransactions = await signTransactions(orderResponse.data.transactions, wallet);
const completeResponse = await axios.post(`${BASE_URL}/api/v2/order/complete`, {
  id: orderResponse.data.id,
  transactions: signedTransactions
}, {
  headers: { Authorization: `Bearer ${API_TOKEN}` }
});
```

### Interactive Trading Session

Run the interactive CLI:
```bash
node sampleScripts/execute-trade-interactive.js
```

The script will prompt for:
1. Network selection (base/bsc)
2. Token contract address
3. Trade direction (buy/sell)
4. Amount
5. Trade confirmation

## Supported Networks

### Base Network
- **Chain ID**: 8453
- **Native Currency**: ETH
- **RPC**: Configure `EXECUTE_TRADE_BASE_RPC_URL`
- **Example Token**: Zora (0x1111111111166b7fe7bd91427724b487980afc69)

### BSC Network
- **Chain ID**: 56
- **Native Currency**: BNB
- **RPC**: Configure `EXECUTE_TRADE_BSC_RPC_URL`
- **Example Token**: USDT (0x55d398326f99059ff775485246999027b3197955)

## Security Features

### EIP-712 Signature Standard
- Uses typed data signing for permit2 transactions
- Signature placeholder replacement for gasless approvals
- Secure transaction signing with ethers.js

### Transaction Safety
- Pre-trade balance validation
- Comprehensive error handling
- Transaction receipt verification
- Slippage protection with customizable limits

## Error Handling

Common error scenarios and responses:
- **Invalid API token**: "Unauthorized" - Check API_TOKEN
- **Insufficient balance**: Balance check before trade execution
- **Invalid token address**: Format validation (40-character hex)
- **Network configuration**: RPC URL validation and availability
- **Transaction failure**: Detailed error messages and retry options

## Code Structure

```
sampleScripts/
├── execute-trade-interactive.js   # Main interactive trading script
└── [future scripts]               # Additional trading utilities

Key Functions:
├── executeTrade()                 # Main trade execution logic
├── getWalletBalances()           # Balance checking utility
├── signTransactions()            # Transaction signing handler
└── main()                        # Interactive CLI loop
```

## Best Practices

1. **Environment Security**: Never commit private keys or API tokens
2. **Network Validation**: Always verify RPC endpoints are configured
3. **Balance Checks**: Monitor balances before and after trades
4. **Error Handling**: Implement comprehensive error catching
5. **Slippage Settings**: Use appropriate slippage for market conditions
6. **MEV Protection**: Always enable MEV protection for better execution

## Troubleshooting

### Common Issues
- **"RPC URL not configured"**: Set network-specific RPC URLs in environment
- **"Invalid token address"**: Ensure 40-character hexadecimal format (0x...)
- **"Transaction failed"**: Check network connectivity and gas availability
- **"Unauthorized"**: Verify API token and permissions

### Debug Mode
Add debug logging by setting environment variable:
```env
DEBUG=o1-exchange:*
```

## Support and Resources

- **API Documentation**: https://docs.o1.exchange/api/trading
- **Example Implementation**: `sampleScripts/execute-trade-interactive.js`
- **Network Status**: Monitor Base and BSC network status
- **Community**: o1.exchange Discord and documentation channels

This skill provides a complete framework for integrating o1.exchange trading capabilities into Claude Code workflows, enabling automated and interactive trading operations with enterprise-grade security and performance features.