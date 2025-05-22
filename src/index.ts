import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createConfig, getQuote, getChains, getTokens, getToken, getTools, getTokenBalance, getTokenBalances, getTokenAllowance, getTokenAllowanceMulticall, getConnections, getStatus, getRoutes, EVM, ChainType } from "@lifi/sdk";
import { createWalletClient, http, Chain as ViemChain } from "viem";
import { mainnet } from "viem/chains";
import NodeCache from "node-cache";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { safeStringify } from "./helper.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "node:crypto";

const app = express();
app.use(express.json());

const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

const _cache = new NodeCache();
const cacheTTL = 60 * 60 * 24;
const lifiIntegrator = "helixbox-mcp";
const lifiProtocol = "LI.FI";

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

app.post("/mcp", async (req, res) => {
    // Check for existing session ID
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
        // Reuse existing transport
        transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
        // New initialization request
        transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sessionId) => {
                // Store the transport by session ID
                transports[sessionId] = transport;
            }
        });

        // Clean up transport when closed
        transport.onclose = () => {
            if (transport.sessionId) {
                delete transports[transport.sessionId];
            }
        };

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
        server.registerTool(
            "swap",
            {
                description: "Swap tokens (cross-chain or same-chain)",
                inputSchema: {
                    fromChain: z.number().describe("Source chain ID"),
                    toChain: z.number().describe("Target chain ID"),
                    fromToken: z.string().describe("Source token address"),
                    toToken: z.string().describe("Target token address"),
                    fromAmount: z.string().describe("Amount in smallest unit (string)"),
                    fromAddress: z.string().describe("User wallet address"),
                    slippage: z.number().optional().describe("Allowed slippage in percent (optional)"),
                },
                outputSchema: {
                    params: z.object({
                        fromChain: z.number().describe("Source chain ID"),
                        toChain: z.number().describe("Target chain ID"),
                        fromToken: z.string().describe("Source token address"),
                        toToken: z.string().describe("Target token address"),
                        fromAmount: z.string().describe("Amount in smallest unit (string)"),
                        fromAddress: z.string().describe("User wallet address"),
                        slippage: z.number().optional().describe("Allowed slippage in percent (optional)"),
                    }),
                    protocol: z.string().describe("Protocol"),
                    quote: z.any().optional().describe("Quote"),
                    error: z.string().optional().describe("Error message"),
                },
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
                        structuredContent: {
                            params: {
                                fromChain,
                                toChain,
                                fromToken,
                                toToken,
                                fromAmount,
                                fromAddress,
                                slippage,
                            },
                            protocol: lifiProtocol,
                            quote: quote,
                        }
                    };
                } catch (error: any) {
                    return {
                        structuredContent: {
                            params: {
                                fromChain,
                                toChain,
                                fromToken,
                                toToken,
                                fromAmount,
                                fromAddress,
                                slippage,
                            },
                            protocol: lifiProtocol,
                            error: `Failed to get swap quote: ${error.message}`,
                        }
                    };
                }
            }
        );

        // bridge tool: cross-chain bridge
        server.registerTool(
            "bridge",
            {
                description: "Bridge tokens",
                inputSchema: {
                    fromChain: z.number().describe("Source chain ID"),
                    toChain: z.number().describe("Target chain ID"),
                    fromToken: z.string().describe("Source token address"),
                    toToken: z.string().describe("Target token address"),
                    fromAmount: z.string().describe("Amount in smallest unit (string)"),
                    fromAddress: z.string().describe("User wallet address"),
                    slippage: z.number().optional().describe("Allowed slippage in percent (optional)"),
                },
                outputSchema: {
                    params: z.object({
                        fromChain: z.number().describe("Source chain ID"),
                        toChain: z.number().describe("Target chain ID"),
                        fromToken: z.string().describe("Source token address"),
                        toToken: z.string().describe("Target token address"),
                        fromAmount: z.string().describe("Amount in smallest unit (string)"),
                        fromAddress: z.string().describe("User wallet address"),
                        slippage: z.number().optional().describe("Allowed slippage in percent (optional)"),
                    }),
                    protocol: z.string().describe("Protocol"),
                    quote: z.any().optional().describe("Quote"),
                    error: z.string().optional().describe("Error message"),
                },
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
                        structuredContent: {
                            params: {
                                fromChain,
                                toChain,
                                fromToken,
                                toToken,
                                fromAmount,
                                fromAddress,
                                slippage,
                            },
                            protocol: lifiProtocol,
                            quote: quote,
                        }
                    };
                } catch (error: any) {
                    return {
                        structuredContent: {
                            params: {
                                fromChain,
                                toChain,
                                fromToken,
                                toToken,
                                fromAmount,
                                fromAddress,
                                slippage,
                            },
                            protocol: lifiProtocol,
                            error: `Failed to get bridge quote: ${error.message}`,
                        }
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
                    let chains = _cache.get("chains");
                    if (!chains) {
                        chains = await getChains();
                        _cache.set("chains", chains, cacheTTL);
                    }
                    return {
                        content: [
                            {
                                type: "text",
                                text: safeStringify(chains),
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
            "tokens-one-chain",
            "Get supported tokens on one chain",
            {
                chain: z.string().optional().describe("Chain key or ID (optional)"),
            },
            async ({ chain }) => {
                try {
                    let lessTokens = _cache.get(`tokens-${chain || "all"}`);
                    if (!lessTokens) {
                        const tokens = await getTokens({ chains: chain ? [chain as any] : undefined, chainTypes: [ChainType.EVM] });
                        lessTokens = tokens.tokens[chain as any].slice(0, 25);
                        _cache.set(`tokens-${chain || "all"}`, lessTokens, 60 * 5);
                    }
                    return {
                        content: [
                            {
                                type: "text",
                                text: safeStringify(lessTokens),
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

        // tokens tool: get supported tokens
        server.tool(
            "tokens-multiple-chains",
            "Get supported tokens on multiple chains",
            {
                chains: z.array(z.string()).optional().describe("List of chain keys (optional)"),
            },
            async ({ chains }) => {
                try {
                    const tokens = await getTokens({ chains: chains ? chains as any : undefined, chainTypes: [ChainType.EVM] });
                    for (const chain in tokens.tokens) {
                        const lessTokens = tokens.tokens[chain].slice(0, 25);
                        tokens.tokens[chain] = lessTokens;
                    }
                    return {
                        content: [
                            {
                                type: "text",
                                text: safeStringify(tokens),
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
                chain: z.string().describe("Chain key or chain ID"),
                token: z.string().describe("Token address or symbol"),
            },
            async ({ chain, token }) => {
                try {
                    let tokenInfo = _cache.get(`token-${chain}-${token}`);
                    if (!tokenInfo) {
                        tokenInfo = await getToken(chain as any, token);
                        _cache.set(`token-${chain}-${token}`, tokenInfo, cacheTTL);
                    }
                    return {
                        content: [
                            {
                                type: "text",
                                text: safeStringify(tokenInfo),
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
                chains: z.array(z.string()).optional().describe("List of chain keys or IDs (optional)"),
            },
            async ({ chains }) => {
                try {
                    const tools = await getTools(chains ? { chains: chains as any } : undefined);
                    return {
                        content: [
                            {
                                type: "text",
                                text: safeStringify(tools),
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
            "quote-to-amount",
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
                                text: safeStringify(data),
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
                            { type: "text", text: safeStringify(data) },
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
        server.registerTool(
            "token-balance",
            {
                description: "Get the balance of a specific token for a wallet",
                inputSchema: {
                    walletAddress: z.string().describe("Wallet address"),
                    chainId: z.number().describe("Chain ID"),
                    token: z.string().describe("Token address"),
                },
                outputSchema: {
                    balance: z.object({
                        chainId: z.number().describe("Chain ID"),
                        address: z.string().describe("Wallet address"),
                        symbol: z.string().describe("Token symbol"),
                        name: z.string().describe("Token name"),
                        decimals: z.number().describe("Token decimals"),
                        priceUSD: z.string().describe("Token price in USD"),
                        coinKey: z.string().describe("Token key"),
                        logoURI: z.string().describe("Token logo URI"),
                        amount: z.string().describe("Token balance"),
                        blockNumber: z.string().describe("Block number"),
                    }),
                    error: z.string().optional().describe("Error message"),
                },
            },
            async ({ walletAddress, chainId, token }) => {
                try {
                    const tokenObj = await getToken(chainId, token);
                    let balance = await getTokenBalance(walletAddress, tokenObj);
                    balance = JSON.parse(safeStringify(balance));
                    return {
                        structuredContent: {
                            balance: balance,
                        },
                    };
                } catch (error: any) {
                    return {
                        structuredContent: {
                            error: `Failed to get token balance: ${error.message}`,
                        },
                    };
                }
            }
        );

        // getTokenBalances tool: get balances for a list of tokens for a wallet
        server.registerTool(
            "token-balances",
            {
                description: "Get balances for a list of tokens for a wallet",
                inputSchema: {
                    walletAddress: z.string().describe("Wallet address"),
                    chainId: z.number().describe("Chain ID"),
                },
                outputSchema: {
                    balances: z.array(z.object({
                        chainId: z.number().describe("Chain ID"),
                        address: z.string().describe("Wallet address"),
                        symbol: z.string().describe("Token symbol"),
                        name: z.string().describe("Token name"),
                        decimals: z.number().describe("Token decimals"),
                        priceUSD: z.string().describe("Token price in USD"),
                        coinKey: z.string().describe("Token key"),
                        logoURI: z.string().describe("Token logo URI"),
                        amount: z.string().describe("Token balance"),
                        blockNumber: z.string().describe("Block number"),
                    })),
                    error: z.string().optional().describe("Error message"),
                },
            },
            async ({ walletAddress, chainId }) => {
                try {
                    const tokens = await getTokens({ chains: [chainId] });
                    let balances = await getTokenBalances(walletAddress, tokens.tokens[chainId]);
                    balances = balances.filter((balance: any) => balance.amount > 0);
                    balances = JSON.parse(safeStringify(balances));
                    return {
                        structuredContent: {
                            balances: balances,
                        },
                    };
                } catch (error: any) {
                    return {
                        structuredContent: {
                            error: `Failed to get token balances: ${error.message}`,
                        },
                    };
                }
            }
        );

        // getTokenAllowance tool: get the allowance of a token for a spender
        server.tool(
            "token-allowance",
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
                            { type: "text", text: safeStringify(allowance) },
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
            "token-allowance-multicall",
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
                            { type: "text", text: safeStringify(allowances) },
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
                            { type: "text", text: safeStringify(data) },
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
                            { type: "text", text: safeStringify(data) },
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
            "gas-price",
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
                            { type: "text", text: safeStringify(data) },
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
            "gas-prices",
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
                            { type: "text", text: safeStringify(data) },
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

        await server.connect(transport);
    } else {
        // Invalid request
        res.status(400).json({
            jsonrpc: '2.0',
            error: {
                code: -32000,
                message: 'Bad Request: No valid session ID provided',
            },
            id: null,
        });
        return;
    }

    // Handle the request
    await transport.handleRequest(req, res, req.body);
});

// Reusable handler for GET and DELETE requests
const handleSessionRequest = async (req: express.Request, res: express.Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
};

// Handle GET requests for server-to-client notifications via SSE
app.get('/mcp', handleSessionRequest);

// Handle DELETE requests for session termination
app.delete('/mcp', handleSessionRequest);

const port = process.env.LISTEN_PORT || 3888;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});