import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createConfig, getQuote, executeRoute, getChains, getTokens, getToken, getTools, getTokenBalance, getTokenBalances, getTokenAllowance, getTokenAllowanceMulticall, getConnections, getStatus, getRoutes, Chain, EVM } from "@lifi/sdk";
import { createWalletClient, http, Chain as ViemChain } from "viem";
import { mainnet } from "viem/chains";

const lifiIntegrator = "helixbox-mcp";

const allChains = await getChains();

createConfig({
    integrator: lifiIntegrator,
    apiKey: process.env.LIFIPRO_API_KEY,
    providers: [
        EVM({
            getWalletClient: async () => createWalletClient({
                chain: mainnet,
                transport: http(),
            }),
            switchChain: async (chainId) =>
                // Switch chain by creating a new wallet client
                createWalletClient({
                    chain: allChains.find((chain) => chain.id == chainId) as unknown as ViemChain,
                    transport: http(),
                }),
        }),
    ]
});

// Create MCP server instance
const server = new McpServer({
    name: "helixbox-mcp",
    version: "0.0.1",
    capabilities: {
        resources: {},
        tools: {},
    },
});

// swap tool: cross-chain or same-chain swap
server.tool(
    "swap",
    "Swap tokens (cross-chain or same-chain)",
    {
        fromChain: z.number().describe("Source chain ID"),
        toChain: z.number().describe("Target chain ID"),
        fromToken: z.string().describe("Source token address"),
        toToken: z.string().describe("Target token address"),
        fromAmount: z.string().describe("Amount in smallest unit (string)"),
        fromAddress: z.string().describe("User wallet address"),
        slippage: z.number().optional().describe("Allowed slippage in percent (optional)"),
    },
    async ({ fromChain, toChain, fromToken, toToken, fromAmount, fromAddress, slippage }) => {
        try {
            const quote = await getQuote({
                fromChain,
                toChain,
                fromToken,
                toToken,
                fromAmount,
                fromAddress,
                slippage,
            });
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(quote, null, 2),
                    },
                ],
            };
        } catch (error: any) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to get swap quote: ${error.message}`,
                    },
                ],
            };
        }
    }
);

// bridge tool: cross-chain bridge
server.tool(
    "bridge",
    "Bridge tokens",
    {
        fromChain: z.number().describe("Source chain ID"),
        toChain: z.number().describe("Target chain ID"),
        fromToken: z.string().describe("Source token address"),
        toToken: z.string().describe("Target token address"),
        fromAmount: z.string().describe("Amount in smallest unit (string)"),
        fromAddress: z.string().describe("User wallet address"),
        slippage: z.number().optional().describe("Allowed slippage in percent (optional)"),
    },
    async ({ fromChain, toChain, fromToken, toToken, fromAmount, fromAddress, slippage }) => {
        try {
            const quote = await getQuote({
                fromChain,
                toChain,
                fromToken,
                toToken,
                fromAmount,
                fromAddress,
                slippage,
                // Specify bridge type
                allowBridges: ["all"],
                allowExchanges: [],
            });
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(quote, null, 2),
                    },
                ],
            };
        } catch (error: any) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to get bridge quote: ${error.message}`,
                    },
                ],
            };
        }
    }
);

// chains tool: get supported chains
server.tool(
    "chains",
    "Get supported chains",
    {},
    async () => {
        try {
            const chains = await getChains();
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(chains, null, 2),
                    },
                ],
            };
        } catch (error: any) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to get chains: ${error.message}`,
                    },
                ],
            };
        }
    }
);

// tokens tool: get supported tokens
server.tool(
    "tokens",
    "Get supported tokens",
    {
        chains: z.array(z.union([z.string(), z.number()])).optional().describe("List of chain IDs or keys (optional)"),
    },
    async ({ chains }) => {
        try {
            const tokens = await getTokens(chains ? { chains: chains as any } : undefined);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(tokens, null, 2),
                    },
                ],
            };
        } catch (error: any) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to get tokens: ${error.message}`,
                    },
                ],
            };
        }
    }
);

// token tool: get token info
server.tool(
    "token",
    "Get token info",
    {
        chain: z.union([z.string(), z.number()]).describe("Chain key or chain ID"),
        token: z.string().describe("Token address or symbol"),
    },
    async ({ chain, token }) => {
        try {
            const tokenInfo = await getToken(chain as any, token);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(tokenInfo, null, 2),
                    },
                ],
            };
        } catch (error: any) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to get token info: ${error.message}`,
                    },
                ],
            };
        }
    }
);

// tools tool: get supported bridges and exchanges
server.tool(
    "tools",
    "Get supported bridges and exchanges",
    {
        chains: z.array(z.union([z.string(), z.number()])).optional().describe("List of chain keys or IDs (optional)"),
    },
    async ({ chains }) => {
        try {
            const tools = await getTools(chains ? { chains: chains as any } : undefined);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(tools, null, 2),
                    },
                ],
            };
        } catch (error: any) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to get tools: ${error.message}`,
                    },
                ],
            };
        }
    }
);

// get-quote-to-amount tool: get a quote for a token transfer using toAmount
server.tool(
    "quoteToAmount",
    "Get a quote for a token transfer using toAmount",
    {
        fromChain: z.number().describe("Source chain ID"),
        toChain: z.number().describe("Target chain ID"),
        fromToken: z.string().describe("Source token address"),
        toToken: z.string().describe("Target token address"),
        toAmount: z.string().describe("Desired amount to receive on target chain (in smallest unit)"),
        fromAddress: z.string().describe("User wallet address"),
        slippage: z.number().optional().describe("Allowed slippage in percent (optional)"),
    },
    async ({ fromChain, toChain, fromToken, toToken, toAmount, fromAddress, slippage }) => {
        try {
            const params = new URLSearchParams({
                fromChain: fromChain.toString(),
                toChain: toChain.toString(),
                fromToken,
                toToken,
                toAmount,
                fromAddress,
            });
            if (slippage !== undefined) {
                params.append("slippage", slippage.toString());
            }
            const url = `https://li.quest/v1/quote/toAmount?${params.toString()}`;
            const res = await fetch(url, {
                headers: {
                    "x-lifi-sdk-integrator": lifiIntegrator,
                    "x-api-key": process.env.LIFIPRO_API_KEY || "",
                },
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${await res.text()}`);
            }
            const data = await res.json();
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(data, null, 2),
                    },
                ],
            };
        } catch (error: any) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to get quote by toAmount: ${error.message}`,
                    },
                ],
            };
        }
    }
);

// getConnections tool: get all available connections for swapping or bridging tokens
server.tool(
    "connections",
    "Get all available connections for swapping or bridging tokens",
    {
        fromChain: z.number().optional().describe("Source chain ID (optional)"),
        fromToken: z.string().optional().describe("Source token address (optional)"),
        toChain: z.number().optional().describe("Target chain ID (optional)"),
        toToken: z.string().optional().describe("Target token address (optional)"),
    },
    async ({ fromChain, fromToken, toChain, toToken }) => {
        try {
            const data = await getConnections({
                fromChain,
                fromToken,
                toChain,
                toToken,
            });
            return {
                content: [
                    { type: "text", text: JSON.stringify(data, null, 2) },
                ],
            };
        } catch (error: any) {
            return {
                content: [
                    { type: "text", text: `Failed to get connections: ${error.message}` },
                ],
            };
        }
    }
);

// getTokenBalance tool: get the balance of a specific token for a wallet
server.tool(
    "tokenBalance",
    "Get the balance of a specific token for a wallet",
    {
        walletAddress: z.string().describe("Wallet address"),
        chainId: z.number().describe("Chain ID"),
        token: z.string().describe("Token address"),
    },
    async ({ walletAddress, chainId, token }) => {
        try {
            const tokenObj = await getToken(chainId, token);
            const balance = await getTokenBalance(walletAddress, tokenObj);
            return {
                content: [
                    { type: "text", text: JSON.stringify(balance, null, 2) },
                ],
            };
        } catch (error: any) {
            return {
                content: [
                    { type: "text", text: `Failed to get token balance: ${error.message}` },
                ],
            };
        }
    }
);

// getTokenBalances tool: get balances for a list of tokens for a wallet
server.tool(
    "tokenBalances",
    "Get balances for a list of tokens for a wallet",
    {
        walletAddress: z.string().describe("Wallet address"),
        chainId: z.number().describe("Chain ID"),
    },
    async ({ walletAddress, chainId }) => {
        try {
            const tokens = await getTokens({ chains: [chainId] });
            const balances = await getTokenBalances(walletAddress, tokens.tokens[chainId]);
            return {
                content: [
                    { type: "text", text: JSON.stringify(balances, null, 2) },
                ],
            };
        } catch (error: any) {
            return {
                content: [
                    { type: "text", text: `Failed to get token balances: ${error.message}` },
                ],
            };
        }
    }
);

// getTokenAllowance tool: get the allowance of a token for a spender
server.tool(
    "tokenAllowance",
    "Get the allowance of a token for a spender",
    {
        token: z.object({
            address: z.string().describe("Token address"),
            chainId: z.number().describe("Chain ID"),
        }),
        ownerAddress: z.string().describe("Owner address"),
        spenderAddress: z.string().describe("Spender address"),
    },
    async ({ token, ownerAddress, spenderAddress }) => {
        try {
            const tokenObj = await getToken(token.chainId, token.address);
            const allowance = await getTokenAllowance(tokenObj, ownerAddress as `0x${string}`, spenderAddress as `0x${string}`);
            return {
                content: [
                    { type: "text", text: JSON.stringify(allowance, null, 2) },
                ],
            };
        } catch (error: any) {
            return {
                content: [
                    { type: "text", text: `Failed to get token allowance: ${error.message}` },
                ],
            };
        }
    }
);

// getTokenAllowanceMulticall tool: Get the allowance of multiple tokens for a spender
server.tool(
    "tokenAllowanceMulticall",
    "Get the allowance of multiple tokens for a spender",
    {
        ownerAddress: z.string().describe("Owner address"),
        tokens: z.array(z.object({
            token: z.object({
                address: z.string().describe("Token address"),
                chainId: z.number().describe("Chain ID"),
            }),
            spenderAddress: z.string().describe("Spender address"),
        })).describe("Array of { token, spenderAddress }"),
    },
    async ({ ownerAddress, tokens }) => {
        try {
            const tokensWithSpender = await Promise.all(tokens.map(async ({ token, spenderAddress }) => ({
                token: await getToken(token.chainId, token.address),
                spenderAddress,
            })));
            const allowances = await getTokenAllowanceMulticall(ownerAddress as `0x${string}`, tokensWithSpender);
            return {
                content: [
                    { type: "text", text: JSON.stringify(allowances, null, 2) },
                ],
            };
        } catch (error: any) {
            return {
                content: [
                    { type: "text", text: `Failed to get token allowance multicall: ${error.message}` },
                ],
            };
        }
    }
);

// getRoutes tool: get all available routes for a token transfer
server.tool(
    "routes",
    "Get all available routes for a token transfer",
    {
        fromChainId: z.number().describe("Source chain ID"),
        toChainId: z.number().describe("Target chain ID"),
        fromTokenAddress: z.string().describe("Source token address"),
        toTokenAddress: z.string().describe("Target token address"),
        fromAmount: z.string().describe("Amount in smallest unit (string)"),
        fromAddress: z.string().optional().describe("User wallet address (optional)"),
    },
    async ({ fromChainId, toChainId, fromTokenAddress, toTokenAddress, fromAmount, fromAddress }) => {
        try {
            const params: any = {
                fromChainId,
                toChainId,
                fromTokenAddress,
                toTokenAddress,
                fromAmount,
            };
            if (fromAddress) params.fromAddress = fromAddress;
            const data = await getRoutes(params);
            return {
                content: [
                    { type: "text", text: JSON.stringify(data, null, 2) },
                ],
            };
        } catch (error: any) {
            return {
                content: [
                    { type: "text", text: `Failed to get routes: ${error.message}` },
                ],
            };
        }
    }
);

server.tool(
    "status",
    "Get the status of a cross-chain or swap transaction",
    {
        txHash: z.string().describe("Transaction hash"),
        bridge: z.string().optional().describe("Bridge key (optional)"),
        fromChain: z.number().optional().describe("Source chain ID (optional)"),
        toChain: z.number().optional().describe("Target chain ID (optional)"),
    },
    async ({ txHash, bridge, fromChain, toChain }) => {
        try {
            const data = await getStatus({
                txHash,
                bridge,
                fromChain,
                toChain,
            });
            return {
                content: [
                    { type: "text", text: JSON.stringify(data, null, 2) },
                ],
            };
        } catch (error: any) {
            return {
                content: [
                    { type: "text", text: `Failed to get status: ${error.message}` },
                ],
            };
        }
    }
);

// getGasPrice tool: get gas price for a specific chain
server.tool(
    "gasPrice",
    "Get gas price for a specific chain",
    {
        chainId: z.number().describe("Chain ID"),
    },
    async ({ chainId }) => {
        try {
            const url = `https://li.quest/v1/gas/prices/${chainId}`;
            const res = await fetch(url, {
                headers: {
                    "x-lifi-sdk-integrator": lifiIntegrator,
                    "x-api-key": process.env.LIFIPRO_API_KEY || "",
                },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
            const data = await res.json();
            return {
                content: [
                    { type: "text", text: JSON.stringify(data, null, 2) },
                ],
            };
        } catch (error: any) {
            return {
                content: [
                    { type: "text", text: `Failed to get gas price: ${error.message}` },
                ],
            };
        }
    }
);

// getGasPrices tool: get gas prices for all supported chains
server.tool(
    "gasPrices",
    "Get gas prices for all supported chains",
    {},
    async () => {
        try {
            const url = `https://li.quest/v1/gas/prices`;
            const res = await fetch(url, {
                headers: {
                    "x-lifi-sdk-integrator": lifiIntegrator,
                    "x-api-key": process.env.LIFIPRO_API_KEY || "",
                },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
            const data = await res.json();
            return {
                content: [
                    { type: "text", text: JSON.stringify(data, null, 2) },
                ],
            };
        } catch (error: any) {
            return {
                content: [
                    { type: "text", text: `Failed to get gas prices: ${error.message}` },
                ],
            };
        }
    }
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("LiFi MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
