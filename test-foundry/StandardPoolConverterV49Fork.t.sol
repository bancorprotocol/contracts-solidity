// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../contracts/converter/types/standard-pool/StandardPoolConverterFactory.sol";

/**
 * @dev mainnet fork rehearsal of the converter v49 (trading toggle) upgrade:
 *
 * 1. deploy the v49 StandardPoolConverterFactory from this repo
 * 2. impersonate the live ConverterFactory owner and register it (replaces the v48 factory)
 * 3. impersonate the live pool owner and run the real ConverterUpgrader flow on ETHBNT
 * 4. verify reserves/fee/anchor integrity and that trading through the REAL June-2020
 *    router still works, then exercise the new setTradingEnabled switch end to end
 *
 * run: forge test --fork-url <mainnet rpc> -vv
 */

interface IVm {
    function prank(address account) external;

    function deal(address account, uint256 newBalance) external;

    function expectRevert(bytes calldata revertData) external;

    function expectRevert() external;
}

interface IOwnedExt {
    function owner() external view returns (address);

    function acceptOwnership() external;
}

interface IConverterExt {
    function upgrade() external;

    function version() external view returns (uint16);

    function reserveBalances() external view returns (uint256, uint256);

    function conversionFee() external view returns (uint32);

    function setTradingEnabled(bool enabled) external;

    function tradingEnabled() external view returns (bool);

    function targetAmountAndFee(
        address sourceToken,
        address targetToken,
        uint256 sourceAmount
    ) external view returns (uint256, uint256);
}

interface IConverterFactoryExt {
    function registerTypedConverterFactory(ITypedConverterFactory factory) external;
}

interface ILegacyNetwork {
    function convertByPath(
        address[] calldata path,
        uint256 sourceAmount,
        uint256 minReturn,
        address beneficiary,
        address affiliateAccount,
        uint256 affiliateFee
    ) external payable returns (uint256);

    function rateByPath(address[] calldata path, uint256 sourceAmount) external view returns (uint256);
}

interface IERC20Ext {
    function balanceOf(address account) external view returns (uint256);
}

contract StandardPoolConverterV49ForkTest {
    IVm private constant vm = IVm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    // live mainnet addresses
    address private constant CONVERTER_FACTORY = 0x4ade0e57Bc2E129f62547af4d620fB40d28EA269;
    address private constant FACTORY_OWNER = 0xdfeE8DC240c6CadC2c7f7f9c257c259914dEa84E;
    address private constant POOL_OWNER = 0x1647F8480C65528aff347602460C3fF9429cEF4d;
    address private constant ETHBNT_ANCHOR = 0xb1CD6e4153B2a390Cf00A6556b0fC1458C4A5533;
    address private constant ROUTER = 0x2F9EC37d6CcFFf1caB21733BdaDEdE11c823cCB0;
    address private constant BNT = 0x1F573D6Fb3F13d689FF844B4cE37794d79a7FF1C;
    address private constant ETH_RESERVE = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    address private constant TRADER = address(0x7e57);

    function setUp() public {
        // deploy the v49 factory and register it on the live ConverterFactory
        StandardPoolConverterFactory factory = new StandardPoolConverterFactory();

        vm.prank(FACTORY_OWNER);
        IConverterFactoryExt(CONVERTER_FACTORY).registerTypedConverterFactory(
            ITypedConverterFactory(address(factory))
        );
    }

    function _ethToBntPath() private pure returns (address[] memory) {
        address[] memory path = new address[](3);
        path[0] = ETH_RESERVE;
        path[1] = ETHBNT_ANCHOR;
        path[2] = BNT;
        return path;
    }

    function _upgradeEthBnt() private returns (address oldConverter, address newConverter) {
        oldConverter = IOwnedExt(ETHBNT_ANCHOR).owner();

        vm.prank(POOL_OWNER);
        IConverterExt(oldConverter).upgrade();

        newConverter = IOwnedExt(ETHBNT_ANCHOR).owner();

        vm.prank(POOL_OWNER);
        IOwnedExt(newConverter).acceptOwnership();
    }

    function testUpgradePreservesPoolState() public {
        address oldConverter = IOwnedExt(ETHBNT_ANCHOR).owner();
        (uint256 oldBalance0, uint256 oldBalance1) = IConverterExt(oldConverter).reserveBalances();
        uint32 oldFee = IConverterExt(oldConverter).conversionFee();

        (, address newConverter) = _upgradeEthBnt();

        require(newConverter != oldConverter, "expected a new converter instance");
        require(IConverterExt(newConverter).version() == 49, "expected version 49");
        require(IOwnedExt(newConverter).owner() == POOL_OWNER, "ownership not transferred");
        require(IConverterExt(newConverter).tradingEnabled(), "trading should default to enabled");

        (uint256 newBalance0, uint256 newBalance1) = IConverterExt(newConverter).reserveBalances();
        require(newBalance0 == oldBalance0 && newBalance1 == oldBalance1, "reserve balances mismatch");
        require(IConverterExt(newConverter).conversionFee() == oldFee, "conversion fee mismatch");
        require(address(oldConverter).balance == 0, "old converter still holds ETH");
        require(IERC20Ext(BNT).balanceOf(oldConverter) == 0, "old converter still holds BNT");
    }

    function testTradingWorksThroughLiveRouterAfterUpgrade() public {
        _upgradeEthBnt();

        address[] memory path = _ethToBntPath();

        vm.deal(TRADER, 10 ether);
        vm.prank(TRADER);
        uint256 targetAmount = ILegacyNetwork(ROUTER).convertByPath{ value: 1 ether }(
            path,
            1 ether,
            1,
            address(0),
            address(0),
            0
        );

        require(targetAmount > 0, "trade through live router failed");
        require(IERC20Ext(BNT).balanceOf(TRADER) == targetAmount, "trader did not receive BNT");
    }

    function testToggleBlocksAndRestoresTrading() public {
        (, address newConverter) = _upgradeEthBnt();

        address[] memory path = _ethToBntPath();
        vm.deal(TRADER, 10 ether);

        // disable trading
        vm.prank(POOL_OWNER);
        IConverterExt(newConverter).setTradingEnabled(false);
        require(!IConverterExt(newConverter).tradingEnabled(), "trading should be disabled");

        vm.prank(TRADER);
        vm.expectRevert(bytes("ERR_TRADING_DISABLED"));
        ILegacyNetwork(ROUTER).convertByPath{ value: 1 ether }(path, 1 ether, 1, address(0), address(0), 0);

        // direct quotes revert...
        vm.expectRevert(bytes("ERR_TRADING_DISABLED"));
        IConverterExt(newConverter).targetAmountAndFee(ETH_RESERVE, BNT, 1 ether);

        // ...and the live router propagates the revert, so routed quotes fail too
        // (a failed eth_call is a clean "skip this pool" signal for aggregators)
        vm.expectRevert();
        ILegacyNetwork(ROUTER).rateByPath(path, 1 ether);

        // re-enable trading
        vm.prank(POOL_OWNER);
        IConverterExt(newConverter).setTradingEnabled(true);

        vm.prank(TRADER);
        uint256 targetAmount = ILegacyNetwork(ROUTER).convertByPath{ value: 1 ether }(
            path,
            1 ether,
            1,
            address(0),
            address(0),
            0
        );
        require(targetAmount > 0, "trade after re-enable failed");
    }

    function testNonOwnerCannotToggle() public {
        (, address newConverter) = _upgradeEthBnt();

        vm.prank(TRADER);
        vm.expectRevert(bytes("ERR_ACCESS_DENIED"));
        IConverterExt(newConverter).setTradingEnabled(false);
    }
}
