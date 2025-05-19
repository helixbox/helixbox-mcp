import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createConfig, getQuote, executeRoute, getChains, getTokens, getToken, getTools } from "@lifi/sdk";

createConfig({
    integrator: "helixbox-mcp",
    apiKey: process.env.LIFIPRO_API_KEY,
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
    "Swap tokens (cross-chain or same-chain) via LiFi",
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
    "Bridge tokens via LiFi",
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
    "Get supported chains via LiFi",
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
    "Get supported tokens via LiFi",
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
    "Get token info via LiFi",
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
    "Get supported bridges and exchanges via LiFi",
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
    "get-quote-to-amount",
    "Get a quote for a token transfer using toAmount via LiFi",
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
                    "x-lifi-sdk-integrator": "helixbox-mcp",
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

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("LiFi MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
