// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// OpenZeppelin Contracts (last updated v4.9.0) (utils/Context.sol)
/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }
}

// OpenZeppelin Contracts (last updated v4.9.0) (access/Ownable.sol)
/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 */
abstract contract Ownable is Context {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor() {
        _transferOwnership(_msgSender());
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

// OpenZeppelin Contracts (last updated v4.9.0) (security/ReentrancyGuard.sol)
/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 */
abstract contract ReentrancyGuard {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
    }

    function _nonReentrantAfter() private {
        _status = _NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == _ENTERED;
    }
}

// OpenZeppelin Contracts (last updated v4.9.0) (token/ERC20/IERC20.sol)
/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `to`.
     */
    function transfer(address to, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `from` to `to` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     */
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract PaymentProcessor is Ownable, ReentrancyGuard {
    IERC20 public usdtToken;
    
    address public adminFeeWallet;
    address public globalAdminWallet;
    
    uint256 public depositFeePercent = 2; // 2% fee on deposits
    uint256 public withdrawalFeePercent = 5; // 5% fee on withdrawals
    
    mapping(address => bool) public authorizedProcessors;
    mapping(string => bool) public processedTransactions;
    
    event DepositProcessed(
        address indexed userWallet,
        string txHash,
        uint256 amount,
        uint256 adminFee,
        uint256 userAmount
    );
    
    event WithdrawalProcessed(
        address indexed userWallet,
        uint256 amount,
        uint256 fee,
        uint256 netAmount
    );
    
    modifier onlyAuthorized() {
        require(authorizedProcessors[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }
    
    constructor(
        address _usdtToken,
        address _adminFeeWallet,
        address _globalAdminWallet
    ) {
        usdtToken = IERC20(_usdtToken);
        adminFeeWallet = _adminFeeWallet;
        globalAdminWallet = _globalAdminWallet;
    }
    
    function processDeposit(
        address userWallet,
        string memory txHash,
        uint256 amount
    ) external onlyAuthorized nonReentrant {
        require(!processedTransactions[txHash], "Transaction already processed");
        require(amount > 0, "Amount must be greater than 0");
        
        // Mark transaction as processed
        processedTransactions[txHash] = true;
        
        // Calculate fees
        uint256 adminFee = (amount * depositFeePercent) / 100;
        uint256 userAmount = amount - adminFee;
        
        // Transfer tokens from user wallet to admin wallets
        require(usdtToken.transferFrom(userWallet, adminFeeWallet, adminFee), "Admin fee transfer failed");
        require(usdtToken.transferFrom(userWallet, globalAdminWallet, userAmount), "User amount transfer failed");
        
        emit DepositProcessed(userWallet, txHash, amount, adminFee, userAmount);
    }
    
    function processWithdrawal(
        address userWallet,
        uint256 amount
    ) external onlyAuthorized nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        // Calculate fees
        uint256 fee = (amount * withdrawalFeePercent) / 100;
        uint256 netAmount = amount - fee;
        
        // Transfer fee to admin wallet
        require(usdtToken.transferFrom(globalAdminWallet, adminFeeWallet, fee), "Fee transfer failed");
        
        // Transfer net amount to user
        require(usdtToken.transferFrom(globalAdminWallet, userWallet, netAmount), "Withdrawal transfer failed");
        
        emit WithdrawalProcessed(userWallet, amount, fee, netAmount);
    }
    
    function addAuthorizedProcessor(address processor) external onlyOwner {
        authorizedProcessors[processor] = true;
    }
    
    function removeAuthorizedProcessor(address processor) external onlyOwner {
        authorizedProcessors[processor] = false;
    }
    
    function updateWallets(address _adminFeeWallet, address _globalAdminWallet) external onlyOwner {
        adminFeeWallet = _adminFeeWallet;
        globalAdminWallet = _globalAdminWallet;
    }
    
    function updateFees(uint256 _depositFee, uint256 _withdrawalFee) external onlyOwner {
        require(_depositFee <= 10 && _withdrawalFee <= 20, "Fees too high");
        depositFeePercent = _depositFee;
        withdrawalFeePercent = _withdrawalFee;
    }
}
