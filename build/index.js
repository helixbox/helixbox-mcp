import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createConfig, getQuote } from "@lifi/sdk";
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
server.tool("swap", "Swap tokens (cross-chain or same-chain) via LiFi", {
    fromChain: z.number().describe("Source chain ID"),
    toChain: z.number().describe("Target chain ID"),
    fromToken: z.string().describe("Source token address"),
    toToken: z.string().describe("Target token address"),
    fromAmount: z.string().describe("Amount in smallest unit (string)"),
    fromAddress: z.string().describe("User wallet address"),
    slippage: z.number().optional().describe("Allowed slippage in percent (optional)"),
}, async ({ fromChain, toChain, fromToken, toToken, fromAmount, fromAddress, slippage }) => {
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
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to get swap quote: ${error.message}`,
                },
            ],
        };
    }
});
// bridge tool: cross-chain bridge
server.tool("bridge", "Bridge tokens via LiFi", {
    fromChain: z.number().describe("Source chain ID"),
    toChain: z.number().describe("Target chain ID"),
    fromToken: z.string().describe("Source token address"),
    toToken: z.string().describe("Target token address"),
    fromAmount: z.string().describe("Amount in smallest unit (string)"),
    fromAddress: z.string().describe("User wallet address"),
    slippage: z.number().optional().describe("Allowed slippage in percent (optional)"),
}, async ({ fromChain, toChain, fromToken, toToken, fromAmount, fromAddress, slippage }) => {
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
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to get bridge quote: ${error.message}`,
                },
            ],
        };
    }
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("LiFi MCP Server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
