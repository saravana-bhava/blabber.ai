import { SupabaseClient } from '@supabase/supabase-js';
import { createWalletClient, createPublicClient, http, formatUnits, parseUnits, Address, isAddress, checksumAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, polygon } from 'viem/chains';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, getAccount, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from '@bitcoinerlab/secp256k1';

const ECPair = ECPairFactory(ecc);

interface TransactionReference {
  table: 'call_transactions' | 'creator_product_transactions' | 'ppv_transactions' | 'tip_transactions' | 'subscription_payments';
  id: string;
}

export interface CryptoPayoutRequest {
  creator_profile_id: string;
  payee_kind?: 'creator' | 'agency';
  amount_cents: number;
  currency: 'crypto';
  payout_method: 'solana' | 'ethereum' | 'polygon' | 'bitcoin';
  blockchain?: string | null;
  solana_address?: string | null;
  ethereum_address?: string | null;
  polygon_address?: string | null;
  bitcoin_address?: string | null;
  transactions: TransactionReference[];
  status: 'initiated';
  created_at: string;
}

// USDC contract addresses (6 decimals)
// Using lowercase so checksumAddress can compute proper checksum
const USDC_CONTRACTS = {
  ethereum: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC on Ethereum mainnet
  polygon: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', // USDC on Polygon
  solana: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC on Solana (SPL token mint)
};

// ERC-20 ABI for transfer function (viem format)
const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

/**
 * Send USDC on Ethereum network using viem
 */
async function sendEthereumUSDC(
  recipientAddress: string,
  amountMicroUSDC: string | number
): Promise<{ txHash: string; success: boolean; error?: string }> {
  try {
    const privateKey = process.env.ETHEREUM_PRIVATE_KEY;
    const rpcUrl = process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com';

    if (!privateKey) {
      throw new Error('ETHEREUM_PRIVATE_KEY not configured');
    }

    // Convert private key to viem account format (remove 0x prefix if present)
    const privateKeyHex = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    const account = privateKeyToAccount(privateKeyHex as `0x${string}`);
    
    // Create public client for reading chain data
    const publicClient = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
    });

    // Create wallet client for signing transactions
    const walletClient = createWalletClient({
      account,
      chain: mainnet,
      transport: http(rpcUrl),
    });

    // Normalize addresses to lowercase and validate format
    // viem requires properly checksummed addresses
    // Trim whitespace and convert to lowercase
    const contractAddressLower = USDC_CONTRACTS.ethereum.trim().toLowerCase();
    const recipientLower = recipientAddress.trim().toLowerCase();
    
    // Validate format (must be 0x followed by 40 hex characters)
    const addressRegex = /^0x[a-f0-9]{40}$/;
    
    if (!addressRegex.test(contractAddressLower)) {
      throw new Error(`Invalid contract address format: ${contractAddressLower} (expected 42 chars, got ${contractAddressLower.length})`);
    }
    if (!addressRegex.test(recipientLower)) {
      throw new Error(`Invalid recipient address format: ${recipientLower} (expected 42 chars, got ${recipientLower.length})`);
    }
    
    // Convert to checksummed format using viem's checksumAddress utility
    const contractAddress = checksumAddress(contractAddressLower as `0x${string}`) as Address;
    const recipientAddr = checksumAddress(recipientLower as `0x${string}`) as Address;

    // Convert amount to BigInt (USDC has 6 decimals, amountMicroUSDC is already in micro units)
    const amount = BigInt(amountMicroUSDC.toString());

    // Write contract transaction - viem handles encoding and signing automatically
    const txHash = await walletClient.writeContract({
      address: contractAddress,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [recipientAddr, amount],
    });

    // Wait for transaction receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    return { txHash: receipt.transactionHash, success: true };
  } catch (error: any) {
    console.error('Ethereum USDC transfer error:', error);
    return { txHash: '', success: false, error: error.message || 'Ethereum transfer failed' };
  }
}

/**
 * Send USDC on Polygon network using viem
 */
async function sendPolygonUSDC(
  recipientAddress: string,
  amountMicroUSDC: string | number
): Promise<{ txHash: string; success: boolean; error?: string }> {
  try {
    const privateKey = process.env.POLYGON_PRIVATE_KEY;
    const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';

    if (!privateKey) {
      throw new Error('POLYGON_PRIVATE_KEY not configured');
    }

    // Convert private key to viem account format (remove 0x prefix if present)
    const privateKeyHex = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    const account = privateKeyToAccount(privateKeyHex as `0x${string}`);
    
    // Create public client for reading chain data
    const publicClient = createPublicClient({
      chain: polygon,
      transport: http(rpcUrl),
    });

    // Create wallet client for signing transactions
    const walletClient = createWalletClient({
      account,
      chain: polygon,
      transport: http(rpcUrl),
    });

    // Normalize addresses to lowercase and validate format
    // viem requires properly checksummed addresses
    const contractAddressLower = USDC_CONTRACTS.polygon.toLowerCase();
    const recipientLower = recipientAddress.toLowerCase();
    
    // Validate format (must be 0x followed by 40 hex characters)
    const addressRegex = /^0x[a-f0-9]{40}$/;
    
    if (!addressRegex.test(contractAddressLower)) {
      throw new Error(`Invalid contract address format: ${contractAddressLower} (expected 42 chars, got ${contractAddressLower.length})`);
    }
    if (!addressRegex.test(recipientLower)) {
      throw new Error(`Invalid recipient address format: ${recipientLower} (expected 42 chars, got ${recipientLower.length})`);
    }
    
    // Convert to checksummed format using viem's checksumAddress utility
    const contractAddress = checksumAddress(contractAddressLower as `0x${string}`) as Address;
    const recipientAddr = checksumAddress(recipientLower as `0x${string}`) as Address;

    // Convert amount to BigInt (USDC has 6 decimals, amountMicroUSDC is already in micro units)
    const amount = BigInt(amountMicroUSDC.toString());

    // Write contract transaction - viem handles encoding and signing automatically
    const txHash = await walletClient.writeContract({
      address: contractAddress,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [recipientAddr, amount],
    });

    // Wait for transaction receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    return { txHash: receipt.transactionHash, success: true };
  } catch (error: any) {
    console.error('Polygon USDC transfer error:', error);
    return { txHash: '', success: false, error: error.message || 'Polygon transfer failed' };
  }
}

/**
 * Send USDC on Solana network
 */
async function sendSolanaUSDC(
  recipientAddress: string,
  amountMicroUSDC: string | number
): Promise<{ txHash: string; success: boolean; error?: string }> {
  try {
    const privateKeyBase58 = process.env.SOLANA_PRIVATE_KEY;
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

    if (!privateKeyBase58) {
      throw new Error('SOLANA_PRIVATE_KEY not configured');
    }

    let keypair: Keypair;
    try {
      const keyArray = JSON.parse(privateKeyBase58);
      keypair = Keypair.fromSecretKey(Buffer.from(keyArray));
    } catch {
      const keyArray = privateKeyBase58.split(',').map(Number);
      keypair = Keypair.fromSecretKey(Buffer.from(keyArray));
    }

    const connection = new Connection(rpcUrl, 'confirmed');
    const usdcMint = new PublicKey(USDC_CONTRACTS.solana);
    const recipientPubkey = new PublicKey(recipientAddress);

    const senderTokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      keypair.publicKey
    );
    const recipientTokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      recipientPubkey
    );

    let transaction = new Transaction();
    try {
      await getAccount(connection, recipientTokenAccount);
    } catch {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          keypair.publicKey,
          recipientTokenAccount,
          recipientPubkey,
          usdcMint
        )
      );
    }

    const amount = BigInt(amountMicroUSDC.toString());

    const transferInstruction = createTransferInstruction(
      senderTokenAccount,
      recipientTokenAccount,
      keypair.publicKey,
      amount
    );

    transaction.add(transferInstruction);
    const signature = await connection.sendTransaction(transaction, [keypair]);

    await connection.confirmTransaction(signature, 'confirmed');

    return { txHash: signature, success: true };
  } catch (error: any) {
    console.error('Solana USDC transfer error:', error);
    return { txHash: '', success: false, error: error.message || 'Solana transfer failed' };
  }
}

/**
 * Fetch UTXOs for a Bitcoin address using Blockstream API
 */
async function fetchUTXOs(address: string, network: bitcoin.Network): Promise<any[]> {
  const apiBase = network === bitcoin.networks.bitcoin 
    ? 'https://blockstream.info/api'
    : 'https://blockstream.info/testnet/api';
  
  const response = await fetch(`${apiBase}/address/${address}/utxo`);
  if (!response.ok) {
    throw new Error(`Failed to fetch UTXOs: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Estimate transaction fee (in satoshis)
 */
function estimateFee(inputCount: number, outputCount: number = 2): number {
  const estimatedSize = (inputCount * 140) + (outputCount * 34) + 10;
  return estimatedSize; // 1 sat/vbyte
}

/**
 * Send BTC on Bitcoin network
 */
async function sendBitcoinBTC(
  recipientAddress: string,
  amountSatoshis: string | number
): Promise<{ txHash: string; success: boolean; error?: string }> {
  try {
    const privateKeyWIF = process.env.BITCOIN_PRIVATE_KEY;
    const useTestnet = process.env.BITCOIN_TESTNET === 'true';
    const network = useTestnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;

    if (!privateKeyWIF) {
      throw new Error('BITCOIN_PRIVATE_KEY not configured');
    }

    // Convert amount to BigInt (bitcoinjs-lib requires BigInt for values)
    const amountSat = typeof amountSatoshis === 'string' 
      ? BigInt(amountSatoshis) 
      : BigInt(amountSatoshis);

    if (amountSat <= BigInt(0)) {
      throw new Error('Invalid amount: must be greater than 0');
    }

    const keyPair = ECPair.fromWIF(privateKeyWIF, network);
    
    // Use Native SegWit (P2WPKH) for better fees - addresses start with "bc1" on mainnet
    // This is more modern and cost-effective than Legacy (P2PKH)
    const { address: senderAddress } = bitcoin.payments.p2wpkh({
      pubkey: keyPair.publicKey,
      network,
    });

    if (!senderAddress) {
      throw new Error('Failed to derive sender address from private key');
    }

    const utxos = await fetchUTXOs(senderAddress, network);
    
    if (utxos.length === 0) {
      throw new Error('No UTXOs found for sender address');
    }

    let totalAvailable = BigInt(0);
    const selectedUTXOs = [];
    
    utxos.sort((a, b) => Number(BigInt(b.value) - BigInt(a.value)));
    
    for (const utxo of utxos) {
      selectedUTXOs.push(utxo);
      totalAvailable += BigInt(utxo.value);
      
      const estimatedFee = BigInt(estimateFee(selectedUTXOs.length, 2));
      const totalNeeded = amountSat + estimatedFee;
      
      if (totalAvailable >= totalNeeded) {
        break;
      }
    }

    const estimatedFee = BigInt(estimateFee(selectedUTXOs.length, 2));
    const totalNeeded = amountSat + estimatedFee;

    if (totalAvailable < totalNeeded) {
      throw new Error(
        `Insufficient funds: need ${totalNeeded} satoshis (including fee), have ${totalAvailable} satoshis`
      );
    }

    const changeAmount = totalAvailable - amountSat - estimatedFee;

    // Get the P2WPKH script for witnessUtxo (same for all inputs from this address)
    const { output: witnessScript } = bitcoin.payments.p2wpkh({
      pubkey: keyPair.publicKey,
      network,
    });

    const psbt = new bitcoin.Psbt({ network });

    for (const utxo of selectedUTXOs) {
      const txHex = await fetch(
        `https://blockstream.info/${network === bitcoin.networks.testnet ? 'testnet/' : ''}api/tx/${utxo.txid}/hex`
      ).then(res => res.text());
      
      // For Native SegWit (P2WPKH), we need both witnessUtxo and nonWitnessUtxo
      // witnessUtxo is the actual UTXO, nonWitnessUtxo is for signing
      const utxoValue = BigInt(utxo.value);
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: witnessScript || Buffer.alloc(0),
          value: utxoValue,
        },
        nonWitnessUtxo: Buffer.from(txHex, 'hex'),
      });
    }

    psbt.addOutput({
      address: recipientAddress,
      value: amountSat,
    });

    if (changeAmount > BigInt(546)) {
      psbt.addOutput({
        address: senderAddress,
        value: changeAmount,
      });
    }

    for (let i = 0; i < selectedUTXOs.length; i++) {
      psbt.signInput(i, keyPair);
    }

    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();

    const apiBase = network === bitcoin.networks.bitcoin 
      ? 'https://blockstream.info/api'
      : 'https://blockstream.info/testnet/api';
    
    const broadcastResponse = await fetch(`${apiBase}/tx`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: tx.toHex(),
    });

    if (!broadcastResponse.ok) {
      const errorText = await broadcastResponse.text();
      throw new Error(`Failed to broadcast transaction: ${errorText}`);
    }

    const txHash = tx.getId();
    return { txHash, success: true };
  } catch (error: any) {
    console.error('Bitcoin BTC transfer error:', error);
    return { txHash: '', success: false, error: error.message || 'Bitcoin transfer failed' };
  }
}

/**
 * Calculate the proportional payee share of the actual amount received
 */
function calculatePayeeShare(
  amountReceived: string,
  amountCents: number,
  payeeShareCents: number | null
): string {
  if (!payeeShareCents || payeeShareCents <= 0 || amountCents <= 0) {
    throw new Error('Invalid payee share or amount');
  }

  const amountReceivedBigInt = BigInt(amountReceived);
  const payeeShareBigInt = BigInt(payeeShareCents);
  const amountCentsBigInt = BigInt(amountCents);

  const payeeShare = (amountReceivedBigInt * payeeShareBigInt) / amountCentsBigInt;

  return payeeShare.toString();
}

/**
 * Calculate total payee payout amount from transaction provider_specific_details.
 * For creator payouts the share is `creator_share_cents - agency_share_cents` (creator take-home).
 * For agency payouts the share is `agency_share_cents`.
 */
export async function calculateTotalCreatorPayoutAmount(
  supabase: SupabaseClient,
  transactions: TransactionReference[],
  blockchain: string,
  payeeKind: 'creator' | 'agency' = 'creator'
): Promise<{ totalAmount: string; error?: string }> {
  let totalAmount = BigInt(0);

  for (const tx of transactions) {
    const { data: transaction, error } = await supabase
      .from(tx.table)
      .select('amount_cents, creator_share_cents, agency_share_cents, provider_specific_details')
      .eq('id', tx.id)
      .single();

    if (error || !transaction) {
      return { totalAmount: '0', error: `Failed to fetch transaction ${tx.id} from ${tx.table}` };
    }

    const providerDetails = transaction.provider_specific_details;
    if (!providerDetails || !providerDetails.amount) {
      return { totalAmount: '0', error: `No amount found in provider_specific_details for transaction ${tx.id}` };
    }

    const amountReceived = providerDetails.amount.toString();
    const agencyShare = Number(transaction.agency_share_cents) || 0;
    const creatorShare = Number(transaction.creator_share_cents) || 0;
    const payeeShareCents =
      payeeKind === 'agency' ? agencyShare : Math.max(0, creatorShare - agencyShare);

    if (payeeShareCents <= 0) {
      // Nothing to pay out from this transaction for this payee.
      continue;
    }

    try {
      const share = calculatePayeeShare(
        amountReceived,
        transaction.amount_cents,
        payeeShareCents
      );
      totalAmount += BigInt(share);
    } catch (calcError: any) {
      return { totalAmount: '0', error: `Failed to calculate payee share for transaction ${tx.id}: ${calcError.message}` };
    }
  }

  return { totalAmount: totalAmount.toString() };
}

/**
 * Process a crypto payout - sends funds to creator's wallet
 * @param supabase - Supabase client (can be admin or regular)
 * @param payoutId - ID of the payout record in the database
 * @param payoutRequest - Payout request details
 * @returns Result with success status, transaction hash, and any errors
 */
export async function processCryptoPayout(
  supabase: SupabaseClient,
  payoutId: string,
  payoutRequest: CryptoPayoutRequest
): Promise<{ success: boolean; error?: string; txHash?: string }> {
  try {
    const { payout_method, transactions, blockchain } = payoutRequest;

    if (!payout_method || !['solana', 'ethereum', 'polygon', 'bitcoin'].includes(payout_method)) {
      return { success: false, error: 'Invalid payout method' };
    }

    const blockchainValue = blockchain || 
      (payout_method === 'ethereum' ? 'ETH' :
       payout_method === 'polygon' ? 'POLYGON' :
       payout_method === 'solana' ? 'SOL' : 'BITCOIN');

    const { totalAmount, error: calcError } = await calculateTotalCreatorPayoutAmount(
      supabase,
      transactions,
      blockchainValue,
      payoutRequest.payee_kind || 'creator'
    );

    if (calcError) {
      return { success: false, error: calcError };
    }

    let recipientAddress: string | null = null;
    let transferResult: { txHash: string; success: boolean; error?: string };

    switch (payout_method) {
      case 'ethereum':
        recipientAddress = payoutRequest.ethereum_address || null;
        if (!recipientAddress) {
          return { success: false, error: 'Ethereum address not provided' };
        }
        transferResult = await sendEthereumUSDC(recipientAddress, totalAmount);
        break;

      case 'polygon':
        recipientAddress = payoutRequest.polygon_address || null;
        if (!recipientAddress) {
          return { success: false, error: 'Polygon address not provided' };
        }
        transferResult = await sendPolygonUSDC(recipientAddress, totalAmount);
        break;

      case 'solana':
        recipientAddress = payoutRequest.solana_address || null;
        if (!recipientAddress) {
          return { success: false, error: 'Solana address not provided' };
        }
        transferResult = await sendSolanaUSDC(recipientAddress, totalAmount);
        break;

      case 'bitcoin':
        recipientAddress = payoutRequest.bitcoin_address || null;
        if (!recipientAddress) {
          return { success: false, error: 'Bitcoin address not provided' };
        }
        transferResult = await sendBitcoinBTC(recipientAddress, totalAmount);
        break;

      default:
        return { success: false, error: `Unsupported payout method: ${payout_method}` };
    }

    if (!transferResult.success) {
      return { 
        success: false, 
        error: transferResult.error || 'Transfer failed',
        txHash: transferResult.txHash || undefined
      };
    }

    // Update payout record with transaction hash
    // Store in both provider_transaction_reference (for backward compatibility) 
    // and blockchain_tx_hash (for user-friendly blockchain explorer links)
    // Since the transfer functions already wait for confirmation, we can mark this as completed
    const { error: updateError } = await supabase
      .from('payouts')
      .update({
        provider_transaction_reference: transferResult.txHash,
        blockchain_tx_hash: transferResult.txHash,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', payoutId);

    if (updateError) {
      console.error('Error updating payout with transaction hash:', updateError);
    }

    
    return { 
      success: true, 
      txHash: transferResult.txHash 
    };
  } catch (error: any) {
    console.error('Error in processCryptoPayout:', error);
    return { 
      success: false, 
      error: error.message || 'Unknown error processing crypto payout' 
    };
  }
}

