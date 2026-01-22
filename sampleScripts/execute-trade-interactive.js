import axios from "axios";
import { JsonRpcProvider, Wallet, Transaction, Contract, formatUnits } from "ethers";
import dotenv from "dotenv";
import readline from "readline";

// Load environment variables from .env.local file (or .env as fallback)
dotenv.config({ path: ".env.local" });

const PRIVATE_KEY = process.env.EXECUTE_TRADE_PRIVATE_KEY || "<PRIVATE_KEY>";
const API_TOKEN = process.env.EXECUTE_TRADE_API_TOKEN || "<API_TOKEN>";
const BASE_URL = process.env.EXECUTE_TRADE_BASE_URL || "https://api.o1.exchange";

// Network configurations
const NETWORKS = {
  base: {
    networkId: 8453,
    name: "Base",
    rpcUrl: process.env.EXECUTE_TRADE_BASE_RPC_URL || "<BASE_RPC_URL>",
    nativeSymbol: "ETH",
  },
  bsc: {
    networkId: 56,
    name: "BSC",
    rpcUrl: process.env.EXECUTE_TRADE_BSC_RPC_URL || "<BSC_RPC_URL>",
    nativeSymbol: "BNB",
  },
};

// Fixed value, don't change it
const SIGNATURE_PLACEHOLDER =
  "42f68902113a2a579bcc207c91254c8516d921250e748c18a082d91d74908f8e9a05f27b72a030c6a42d77d0e0aab6fb09219b01a01e7b5b24e4f322ee1762ff1b";

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Helper function to prompt for user input
const question = (prompt) => {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
};

// ERC20 ABI for balance checking
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

// Function to get wallet balances
const getWalletBalances = async (provider, wallet, tokenAddress = null) => {
  try {
    const balances = {};

    // Get ETH balance
    const ethBalance = await provider.getBalance(wallet.address);
    balances.eth = {
      raw: ethBalance,
      formatted: (Number(ethBalance) / 1e18).toFixed(6),
    };

    // Get token balance if token address provided
    if (tokenAddress) {
      try {
        const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
        const [balance, decimals, symbol] = await Promise.all([
          tokenContract.balanceOf(wallet.address),
          tokenContract.decimals(),
          tokenContract.symbol().catch(() => "TOKEN"),
        ]);

        balances.token = {
          raw: balance,
          formatted: parseFloat(formatUnits(balance, decimals)).toFixed(6),
          symbol: symbol,
          address: tokenAddress,
        };
      } catch (error) {
        console.log("Could not fetch token balance");
      }
    }

    return balances;
  } catch (error) {
    console.error("Error fetching balances:", error);
    return null;
  }
};

const executeTrade = async (
  tokenAddress,
  uiAmount,
  direction,
  slippageBps = 300,
  network = NETWORKS.base,
) => {
  try {
    const provider = new JsonRpcProvider(network.rpcUrl);
    const wallet = new Wallet(PRIVATE_KEY);

    console.log(
      `\nExecuting ${direction} order on ${network.name} for ${uiAmount} ${direction === "buy" ? network.nativeSymbol : "tokens"} of ${tokenAddress}...`,
    );

    // Get balances before trade
    console.log("\nBalances before trade:");
    const balancesBefore = await getWalletBalances(
      provider,
      wallet,
      tokenAddress,
    );
    if (balancesBefore) {
      console.log(`   ${network.nativeSymbol}: ${balancesBefore.eth.formatted}`);
      if (balancesBefore.token) {
        console.log(
          `   ${balancesBefore.token.symbol}: ${balancesBefore.token.formatted}`,
        );
      }
    }

    const { data } = await axios.post(
      `${BASE_URL}/api/v2/order`,
      {
        signerAddress: wallet.address,
        tokenAddress,
        uiAmount,
        direction,
        slippageBps,
        mevProtection: true,
        networkId: network.networkId,
      },
      {
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
        },
      },
    );

    if (data.success) {
      const txContexts = data.transactions;
      const requestBody = {
        id: data.id,
        transactions: [],
      };

      for (const ctx of txContexts) {
        const submitCtx = {
          id: ctx.id,
        };

        const unsignedTx = Transaction.from(ctx.unsigned);
        if (ctx?.permit2?.eip712) {
          const { domain, types, values } = ctx.permit2.eip712;
          const signature = await wallet.signTypedData(domain, types, values);
          let data = unsignedTx.data;
          data = data.replace(SIGNATURE_PLACEHOLDER, signature.slice(2));
          unsignedTx.data = data;

          submitCtx.permit2 = {
            eip712: {
              signature,
            },
          };
        }
        const signedTx = await wallet.signTransaction(unsignedTx);
        submitCtx.signed = signedTx;
        requestBody.transactions.push(submitCtx);
      }

      // Submit the signed transactions
      const submitResponse = await axios.post(
        `${BASE_URL}/api/v2/order/complete`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${API_TOKEN}`,
          },
        },
      );

      if (submitResponse.data.success) {
        console.log("\n✅ Transaction submitted successfully!");
        if (submitResponse.data.transactions) {
          for (const tx of submitResponse.data.transactions) {
            if (tx.hash) {
              console.log(`   Transaction hash: ${tx.hash}`);
            }
            if (tx.tokenDelta) {
              console.log(`   Token Balance Change: ${tx.tokenDelta}`);
            }
          }
        }
      } else {
        console.error(
          "❌ Transaction submission failed:",
          submitResponse.data.message,
        );
        return false;
      }

      // Get balances after trade
      console.log("\nBalances after trade:");
      const balancesAfter = await getWalletBalances(
        provider,
        wallet,
        tokenAddress,
      );
      if (balancesAfter) {
        console.log(`   ${network.nativeSymbol}: ${balancesAfter.eth.formatted}`);
        if (balancesAfter.token) {
          console.log(
            `   ${balancesAfter.token.symbol}: ${balancesAfter.token.formatted}`,
          );
        }

        // Show the change
        if (balancesBefore) {
          console.log("\n Balance changes:");
          const ethChange =
            Number(balancesAfter.eth.formatted) -
            Number(balancesBefore.eth.formatted);
          console.log(
            `   ${network.nativeSymbol}: ${ethChange > 0 ? "+" : ""}${ethChange.toFixed(6)}`,
          );

          if (balancesBefore.token && balancesAfter.token) {
            const tokenChange =
              Number(balancesAfter.token.formatted) -
              Number(balancesBefore.token.formatted);
            console.log(
              `   ${balancesAfter.token.symbol}: ${tokenChange > 0 ? "+" : ""}${tokenChange.toFixed(6)}`,
            );
          }
        }
      }

      return true;
    } else {
      console.error("❌ Error:", data.message);
      return false;
    }
  } catch (error) {
    console.error("❌ Error executing trade:", error.message || error);
    return false;
  }
};

const main = async () => {
  // Check if required environment variables are set
  if (
    PRIVATE_KEY === "<PRIVATE_KEY>" ||
    API_TOKEN === "<API_TOKEN>"
  ) {
    console.error(
      "Please set the required environment variables in your .env.local file:",
    );
    console.error("- EXECUTE_TRADE_PRIVATE_KEY");
    console.error("- EXECUTE_TRADE_API_TOKEN");
    console.error("- EXECUTE_TRADE_BASE_URL (optional, defaults to https://api.o1.exchange)");
    console.error("- EXECUTE_TRADE_BASE_RPC_URL (for Base)");
    console.error("- EXECUTE_TRADE_BSC_RPC_URL (for BSC)");
    process.exit(1);
  }

  console.log("Trading CLI");
  console.log("============================");
  const wallet = new Wallet(PRIVATE_KEY);
  console.log("Wallet Address: ", wallet.address);
  console.log("\nSupported Networks:");
  console.log("  - base: Base (ETH)");
  console.log("  - bsc: BNB Smart Chain (BNB)");
  console.log("\nExample Token Addresses:");
  console.log("  Base (Zora): 0x1111111111166b7fe7bd91427724b487980afc69");
  console.log("  BSC (USDT): 0x55d398326f99059ff775485246999027b3197955");
  console.log("\nType 'exit' or 'quit' at any prompt to stop the script.\n");

  while (true) {
    try {
      // Prompt for network selection
      const networkInput = await question(
        "Select network (base/bsc) [default: base]: ",
      );
      if (
        networkInput.toLowerCase() === "exit" ||
        networkInput.toLowerCase() === "quit"
      ) {
        console.log("Exiting...");
        break;
      }

      // Get selected network (default to base)
      const networkKey = networkInput.toLowerCase() || "base";
      const network = NETWORKS[networkKey];
      if (!network) {
        console.log("⚠️  Invalid network. Please enter 'base' or 'bsc'.\n");
        continue;
      }

      // Check if RPC URL is configured for selected network
      if (network.rpcUrl === "<BASE_RPC_URL>" || network.rpcUrl === "<BSC_RPC_URL>") {
        console.log(`⚠️  RPC URL not configured for ${network.name}.`);
        console.log(`   Please set EXECUTE_TRADE_${networkKey.toUpperCase()}_RPC_URL in your .env.local file.\n`);
        continue;
      }

      console.log(`\nSelected network: ${network.name}`);

      // Prompt for token address
      const tokenAddress = await question(
        "Enter token address (or 'exit' to quit): ",
      );
      if (
        tokenAddress.toLowerCase() === "exit" ||
        tokenAddress.toLowerCase() === "quit"
      ) {
        console.log("Exiting...");
        break;
      }

      // Validate token address format (basic check)
      if (!tokenAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        console.log(
          "⚠️  Invalid token address format. Please enter a valid EVM address.\n",
        );
        continue;
      }

      // Prompt for buy/sell direction
      const direction = await question("Enter direction (buy/sell): ");
      if (
        direction.toLowerCase() === "exit" ||
        direction.toLowerCase() === "quit"
      ) {
        console.log("Exiting...");
        break;
      }

      // Validate direction
      if (
        direction.toLowerCase() !== "buy" &&
        direction.toLowerCase() !== "sell"
      ) {
        console.log("⚠️  Invalid direction. Please enter 'buy' or 'sell'.\n");
        continue;
      }

      // Prompt for amount
      const amount = await question(
        `Enter amount (${direction.toLowerCase() === "buy" ? network.nativeSymbol : "tokens"}): `,
      );
      if (amount.toLowerCase() === "exit" || amount.toLowerCase() === "quit") {
        console.log("Exiting...");
        break;
      }

      // Validate amount
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        console.log("⚠️  Invalid amount. Please enter a positive number.\n");
        continue;
      }

      // Fixed slippage at 3%
      const slippageBps = 300;

      // Confirm trade details
      console.log("\nTrade Summary:");
      console.log(`   Network: ${network.name}`);
      console.log(`   Token: ${tokenAddress}`);
      console.log(`   Direction: ${direction.toLowerCase()}`);
      console.log(
        `   Amount: ${amount} ${direction.toLowerCase() === "buy" ? network.nativeSymbol : "tokens"}`,
      );
      console.log(`   Slippage: 3%`);
      console.log(`   MEV Protection: ${network.networkId === NETWORKS.base.networkId || network.networkId === NETWORKS.bsc.networkId ? "Yes" : "No"}`);

      const confirm = await question("\nConfirm trade? (yes/no): ");
      if (
        confirm.toLowerCase() === "exit" ||
        confirm.toLowerCase() === "quit"
      ) {
        console.log("Exiting...");
        break;
      }

      if (confirm.toLowerCase() === "yes" || confirm.toLowerCase() === "y") {
        await executeTrade(
          tokenAddress,
          amount,
          direction.toLowerCase(),
          slippageBps,
          network,
        );
      } else {
        console.log("❌ Trade cancelled.\n");
      }

      // Ask if user wants to make another trade
      const another = await question(
        "\nWould you like to make another trade? (yes/no): ",
      );
      if (another.toLowerCase() !== "yes" && another.toLowerCase() !== "y") {
        console.log("Exiting...");
        break;
      }
      console.log(""); // Add blank line for next iteration
    } catch (error) {
      console.error("❌ An error occurred:", error);
      const retry = await question("\nWould you like to try again? (yes/no): ");
      if (retry.toLowerCase() !== "yes" && retry.toLowerCase() !== "y") {
        break;
      }
    }
  }

  rl.close();
  process.exit(0);
};

main();
