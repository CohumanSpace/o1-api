# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an HTTP interface to o1.exchange trading, liquidity, and tooling. The project provides sample scripts for interacting with the o1.exchange API to execute trades on various blockchain networks.

## Architecture

### Core Components

- **sampleScripts/execute-trade-interactive.js**: Interactive trading script that allows users to execute buy/sell orders on supported networks (Base and BSC) through o1.exchange API
- **Trading Flow**: Uses ethers.js for blockchain interaction, axios for API calls, and implements EIP-712 signature standards for permit2 transactions

### Key Dependencies

The project uses ES modules and requires:
- `axios` for HTTP API calls to o1.exchange
- `ethers` for blockchain interactions, wallet management, and transaction signing
- `dotenv` for environment variable management
- `readline` for interactive CLI input

## Environment Configuration

Required environment variables (set in `.env.local`):
- `EXECUTE_TRADE_PRIVATE_KEY`: Wallet private key for signing transactions
- `EXECUTE_TRADE_API_TOKEN`: o1.exchange API authentication token
- `EXECUTE_TRADE_BASE_URL`: API base URL (defaults to https://api.o1.exchange)
- `EXECUTE_TRADE_BASE_RPC_URL`: Base network RPC endpoint
- `EXECUTE_TRADE_BSC_RPC_URL`: BSC network RPC endpoint

## Running the Project

To run the interactive trading script:
```bash
node sampleScripts/execute-trade-interactive.js
```

The script provides an interactive CLI for:
1. Network selection (Base or BSC)
2. Token address input
3. Trade direction (buy/sell)
4. Amount specification
5. Trade confirmation and execution

## Network Support

Currently supports:
- **Base** (Chain ID: 8453): Uses ETH as native currency
- **BSC** (Chain ID: 56): Uses BNB as native currency

Both networks include MEV protection and use a fixed 3% slippage tolerance.

## Trading Implementation Details

- Uses o1.exchange API v2 endpoints for order creation and completion
- Implements EIP-712 typed data signing for permit2 transactions
- Handles both regular transaction signing and permit2 signature replacement
- Provides pre/post trade balance checking for transparency
- Includes comprehensive error handling and user-friendly prompts