// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Capped} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title Noor (NUR)
 * @notice A self-contained digital currency issued on the Arc Network, Circle's
 *         USDC-native, EVM-compatible Layer 1 (testnet chain id 5042002).
 *
 * @dev Composition:
 *      - ERC-20 (OpenZeppelin v5.1.0)                : the base currency standard
 *      - ERC20Permit (EIP-2612)                      : gasless approvals via signatures
 *      - ERC20Capped                                 : an immutable, hard supply ceiling
 *      - ERC20Burnable                               : holders can provably destroy supply
 *      - ERC20Pausable                               : owner circuit breaker for emergencies
 *      - Ownable2Step                                : two-step, non-accidental ownership handover
 *      - Anti-whale transaction/wallet limits        : optional, launch-phase protection
 *      - Optional treasury fee                       : defaults to 0, hard-capped at 5%
 *      - batchTransfer                               : one-transaction airdrop/distribution
 *
 *      Issuer powers are deliberately bounded and observable: the supply cap is
 *      immutable, the fee can never exceed MAX_FEE_BPS, and every privileged
 *      action emits an event.
 */
contract NoorCoin is ERC20, ERC20Burnable, ERC20Capped, ERC20Pausable, ERC20Permit, Ownable2Step {
    /// @notice Hard ceiling on the transfer fee: 5.00%.
    uint256 public constant MAX_FEE_BPS = 500;
    /// @notice Denominator used for basis-point math.
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Destination of the optional transfer fee.
    address public treasury;
    /// @notice Current transfer fee in basis points. `0` means fee-less transfers.
    uint256 public feeBps;

    /// @notice Whether anti-whale limits are enforced.
    bool public limitsEnabled;
    /// @notice Maximum amount movable in a single transfer, when limits are enabled.
    uint256 public maxTxAmount;
    /// @notice Maximum balance a single wallet may hold, when limits are enabled.
    uint256 public maxWalletAmount;

    /// @notice Accounts excluded from anti-whale limits and from the transfer fee.
    mapping(address account => bool exempt) public isExempt;

    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event FeeUpdated(uint256 previousFeeBps, uint256 newFeeBps);
    event LimitsUpdated(bool enabled, uint256 maxTxAmount, uint256 maxWalletAmount);
    event ExemptionUpdated(address indexed account, bool exempt);

    error ZeroAddress();
    error FeeTooHigh(uint256 requested, uint256 maximum);
    error InvalidLimits();
    error TransferLimitExceeded(uint256 amount, uint256 limit);
    error WalletLimitExceeded(uint256 resultingBalance, uint256 limit);
    error LengthMismatch();
    error CapBelowInitialSupply(uint256 cap, uint256 initialSupply);

    /**
     * @param initialOwner   Account that receives the initial supply and owner rights.
     * @param initialSupply  Tokens minted at deploy time (in wei, 18 decimals).
     * @param capAmount      Immutable maximum supply. Must be >= `initialSupply`.
     * @param treasury_      Recipient of the optional transfer fee. Must not be zero.
     */
    constructor(
        address initialOwner,
        uint256 initialSupply,
        uint256 capAmount,
        address treasury_
    ) ERC20("Noor", "NUR") ERC20Capped(capAmount) ERC20Permit("Noor") Ownable(initialOwner) {
        if (initialOwner == address(0) || treasury_ == address(0)) revert ZeroAddress();
        if (capAmount < initialSupply) revert CapBelowInitialSupply(capAmount, initialSupply);

        treasury = treasury_;

        // Core protocol accounts are always exempt so that distribution and
        // market-making are never blocked by the launch-phase limits.
        isExempt[initialOwner] = true;
        isExempt[treasury_] = true;
        isExempt[address(this)] = true;

        if (initialSupply > 0) {
            _mint(initialOwner, initialSupply);
        }
    }

    // ---------------------------------------------------------------------
    // Issuance
    // ---------------------------------------------------------------------

    /**
     * @notice Mint new supply. Owner-only and strictly bounded by the immutable cap.
     * @dev Inherited {ERC20Capped} reverts with `ERC20ExceededCap` past the ceiling.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        _mint(to, amount);
    }

    // ---------------------------------------------------------------------
    // Distribution
    // ---------------------------------------------------------------------

    /**
     * @notice Send many transfers in a single transaction (airdrops, payroll, rewards).
     * @dev Goes through the normal transfer path, so limits, fees and the pause
     *      switch all still apply.
     */
    function batchTransfer(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        if (recipients.length != amounts.length) revert LengthMismatch();

        for (uint256 i; i < recipients.length; ++i) {
            // Reverts on zero recipient, insufficient balance or an active limit.
            _transfer(_msgSender(), recipients[i], amounts[i]);
        }
    }

    // ---------------------------------------------------------------------
    // Policy controls
    // ---------------------------------------------------------------------

    /// @notice Pause all transfers, mints and burns. Emergency use only.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resume normal operation.
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Configure the anti-whale guards.
     * @param maxTx     Maximum per-transaction amount (0 to disable enforcement).
     * @param maxWallet Maximum per-wallet balance (0 to disable enforcement).
     * @param enabled   Whether the guards are active.
     */
    function setLimits(uint256 maxTx, uint256 maxWallet, bool enabled) external onlyOwner {
        if (enabled && (maxTx == 0 || maxWallet == 0)) revert InvalidLimits();
        limitsEnabled = enabled;
        maxTxAmount = maxTx;
        maxWalletAmount = maxWallet;
        emit LimitsUpdated(enabled, maxTx, maxWallet);
    }

    /**
     * @notice Set the transfer fee and its recipient.
     * @param newFeeBps New fee in basis points; must not exceed {MAX_FEE_BPS}.
     * @param newTreasury Recipient of collected fees.
     */
    function setFee(uint256 newFeeBps, address newTreasury) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh(newFeeBps, MAX_FEE_BPS);
        if (newTreasury == address(0)) revert ZeroAddress();

        emit TreasuryUpdated(treasury, newTreasury);
        emit FeeUpdated(feeBps, newFeeBps);

        feeBps = newFeeBps;
        treasury = newTreasury;
    }

    /// @notice Exempt or re-exempt an account from limits and fees (pools, bridges, treasuries).
    function setExempt(address account, bool exempt) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        isExempt[account] = exempt;
        emit ExemptionUpdated(account, exempt);
    }

    // ---------------------------------------------------------------------
    // Core transfer hook
    // ---------------------------------------------------------------------

    /**
     * @dev Single choke point for every balance movement. Applies, in order:
     *      1. anti-whale guards (skipped for mints, burns and exempt accounts)
     *      2. the optional treasury fee (skipped for the same set)
     *      3. the immutable supply cap (ERC20Capped)
     *      4. the pause switch (ERC20Pausable)
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Capped, ERC20Pausable) {
        bool isMint = from == address(0);
        bool isBurn = to == address(0);

        if (!isMint && !isBurn) {
            bool guarded = limitsEnabled && !isExempt[from] && !isExempt[to];

            if (guarded) {
                if (maxTxAmount != 0 && value > maxTxAmount) {
                    revert TransferLimitExceeded(value, maxTxAmount);
                }
                if (maxWalletAmount != 0 && balanceOf(to) + value > maxWalletAmount) {
                    revert WalletLimitExceeded(balanceOf(to) + value, maxWalletAmount);
                }
            }

            uint256 fee = (feeBps != 0 && !isExempt[from] && !isExempt[to])
                ? (value * feeBps) / BPS_DENOMINATOR
                : 0;

            if (fee != 0) {
                super._update(from, treasury, fee);
                super._update(from, to, value - fee);
                return;
            }
        }

        super._update(from, to, value);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Remaining amount that can still be minted before the immutable cap.
    function remainingMintable() external view returns (uint256) {
        return cap() - totalSupply();
    }
}
