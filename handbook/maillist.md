## Mail lists

In the real-world application, you usually want to show to the user the list of her incoming emails. When you deal with a multi-chain world, it may be hard to retrieve all the messages from all chains in an optimal way. Moreover, you want to show it in descending order (latest first) and be able to load messages gradually, not all at once.

Moreover, scanning blockchains, again and again, may be hard and expensive. Due to the immutable nature of the blockchains, it seems reasonable to cache messages in some local storage.

Moreover, sometimes we want to apply some filters over the messages list. For example - to hide some messages or to show only messages of a certain user.

That’s why we implemented a set of tools to facilitate work with the messages list in Ylide.

### SourceReadingSession

Instance of this class identifies your app's blockchain reading session - it should be created in the very beginning. It is responsible for sharing instances of cachers and blockchain readers across different mail lists.

```ts
import { SourceReadingSession } from '@ylide/sdk';

const session = new SourceReadingSession();
```

Some blockchain connectors support more optimized ways of retrieving message history from the blockchain. To use them, you can assign the `sourceOptimizer` property of the `SourceReadingSession` instance.

For example, we can use such optimization for EVM-like blockchains:

```ts
session.sourceOptimizer = (subject, reader) => {
	if (reader instanceof EthereumBlockchainController) {
		return new EthereumListSource(reader, subject, 30000); // pull every 30 seconds
	} else {
		return new BlockchainMessagesSource(reader, subject, 10000); // pull every 10 seconds
	}
};
```

Let's set up some blockchain readers:

```ts
import { evmFactories, EVMNetwork, EVM_NAMES } from '@ylide/ethereum';

Ylide.registerBlockchainFactory(evmFactories[EVMNetwork.ETHEREUM]);
Ylide.registerBlockchainFactory(evmFactories[EVMNetwork.BNBCHAIN]);
Ylide.registerBlockchainFactory(evmFactories[EVMNetwork.POLYGON]);

const ethereumReader = await Ylide.addBlockchain(evmFactories[EVMNetwork.ETHEREUM].blockchain);
const bnbReader = await Ylide.addBlockchain(evmFactories[EVMNetwork.BNBCHAIN].blockchain);
const polygonReader = await Ylide.addBlockchain(evmFactories[EVMNetwork.POLYGON].blockchain);
```

Once your `SourceReadingSession` is set up, you can create list sources:

```ts
// This list source will read all the incoming messages in Ethereum for the recipient with address 0:86c4c21...977
const ethereumListSource = this.readingSession.listSource(
	{
		blockchain: EVM_NAMES[EVMNetwork.ETHEREUM],
		type: BlockchainSourceType.DIRECT,
		recipient: '86c4c21b15f373d77e80d6449358cfe59fc9a03e756052ac52258d8dd0ceb977',
		sender: null,
	},
	ethereumReader,
);

// This list source will read all the incoming messages in Binance Smart Chain for the recipient with address 0:86c4c21...977
const bnbListSource = this.readingSession.listSource(
	{
		blockchain: EVM_NAMES[EVMNetwork.BNBCHAIN],
		type: BlockchainSourceType.DIRECT,
		recipient: '86c4c21b15f373d77e80d6449358cfe59fc9a03e756052ac52258d8dd0ceb977',
		sender: null,
	},
	bnbReader,
);

// This list source will read all the incoming messages in Polygon for the recipient with address 0:86c4c21...977
const polygonListSource = this.readingSession.listSource(
	{
		blockchain: EVM_NAMES[EVMNetwork.POLYGON],
		type: BlockchainSourceType.DIRECT,
		recipient: '86c4c21b15f373d77e80d6449358cfe59fc9a03e756052ac52258d8dd0ceb977',
		sender: null,
	},
	polygonReader,
);
```

So, now you have 3 message sources initialized. How to read them?

```ts
// Multiplexer helps you to combine messages from different sources into one unified sorted list.
const multiplexer = new ListSourceMultiplexer([ethereumListSource, bnbListSource, polygonListSource]);

// Drainer helps to paginate multiplexer and apply filters on top of it
const list = new ListSourceDrainer(multiplexer);

// To apply some filter just call:
list.resetFilter(m => m.msg.senderAddress.startsWith('0x1020')); // only messages from the addresses starting with 0x1020

// To initialize a new list call:
await list.resume();

// To read the next 10 messages of the list:
const msgs = await list.readMore(10);
console.log('Current list messages: ', msgs);

// To subscribe for new messages:
list.on('messages', ({ messages }) => {
	console.log('Current list messages:', messages);
});
```

That's it. All the messages loaded through `ListSource` by default are cached in the indexedDB, so it will take much less time to do subsequent loads after the first one.
