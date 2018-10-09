# Decentralized Exchange Based On Bancor Protocol

> this is a project forked from https://github.com/bancorprotocol/contracts.git and with high availability.

Big thanks to bancor team.

### Diffrence
we fix some bugs in master branch and add BancorExchange to make it more developer-friendly.

### How to buy ERC223SmartToken with ETH
```js
bancorExchange.buyRING(minReturn)
```
`minReturn` refers to the minimum amount of ERC223SmartToken you expected.

Note that it's a payable function, so give it a msg.value which greater than 0.


### how to change SmartToken back to ETH
```js
ERC223SmartToken.transfer(address(bancorExchange), amountOfSmartToken,  bytes(miniReturn))
```
`minReturn` here refers to the minimum amount of ETH you expected.

### Contracts' addresses on KOVAN
```js
registry: 0x9f52ec86ed4f7ceedb0e8fc94c76399b2c79eff3
contractIds: 0xc431d623e4253d5ba0f8ed007baadf6994c3e5ad
contractFeatures: 0x179d7a5cf9355d0580198ba026d85ffb08316878
featureIds: 0x48ec4d37e91ff45c5c647b6b06453b80e7553f62
bancorFormula: 0x77105500246ef164562dff7a43c12cee3d6ed0e9
bancorNetwork: 0x4e0b46580f2670be8ec84d7ba994a38011126cf4
EtherToken: 0x026b36615f1f7b284ce58882621284d1df6835c8
ERC223SmartToken: 0x6df4e0da83e47e3f6cd7d725224bc73f0e198c4f
bancorConverter: 0x297569cf3910ee67dad67a8796c7ff1dd5f2c3d3
bancorPriceLimit: 0xc23373a92c9c154a50353e990ecb03971d6c73c9
whiteList: 0x620dcf8745fe240babb935720a5cf6137bf5f68a
bancorExchange: 0xe243c71d1531c356c8a7072979d4acc7362761ba
```

thanks for testing.
