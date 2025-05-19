import { createConfig, getQuote, executeRoute, getChains, getTokens, getToken, getTools, getTokenBalance, getTokenBalances, getTokenAllowance, getTokenAllowanceMulticall, getConnections, getStatus, getRoutes, EVM } from "@lifi/sdk";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum, mainnet, optimism, polygon, scroll } from 'viem/chains'
import type { Chain } from 'viem'
import { createWalletClient, http } from 'viem'

const chains = await getChains();

const client = createWalletClient({
    chain: mainnet,
    transport: http(),
})

createConfig({
    integrator: "test",
    apiKey: process.env.LIFIPRO_API_KEY,
    providers: [
        EVM({
            getWalletClient: async () => client,
            switchChain: async (chainId) =>
                // Switch chain by creating a new wallet client
                createWalletClient({
                    chain: chains.find((chain) => chain.id == chainId) as unknown as Chain,
                    transport: http(),
                }),
        }),
    ]
});

const tokenObj = await getToken(1, "0x0000000000000000000000000000000000000000");
console.log(tokenObj);
const balance = await getTokenBalance("0xdEBC25Dba4445Af08859d6A37659Cb203030D8d7", tokenObj);
console.log(balance);
