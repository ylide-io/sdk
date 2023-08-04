## Getting started

For all examples we will use Everscale connectors from `@ylide/everscale`.

So, first of all you should import these connectors:

```ts
import { everscaleBlockchainFactory, everscaleWalletFactory } from '@ylide/everscale';
```

You can easily verify availability of EverWallet in user's browser:

```ts
const isWalletAvailable = await everscaleWalletFactory.isWalletAvailable();
```

Then, let's instantiate `Ylide`, `YlideKeysRegistry` with `BrowserLocalStorage`:

```ts
let provider;

const storage = new BrowserLocalStorage();
const keyRegistry = new YlideKeysRegistry(storage);

await keyRegistry.init();
```

So, our next step is to initialize Ylide, blockchain and wallet controllers:

```ts
const ylide = new Ylide(keyRegistry);

ylide.registerBlockchainFactory(everscaleBlockchainFactory);
ylide.registerWalletFactory(everscaleWalletFactory);

const blockchain = await ylide.controllers.addBlockchain('everscale');
const wallet = await ylide.controllers.addWallet('everscale', 'everwallet');
```

## Initializing communication key

First of all, you should request access to the wallet account. Let's do this:

```ts
const account = await wallet.requestAuthentication();
```

Now, we are ready for the creation of our first communication key:

```ts
const key = await keyRegistry.instantiateNewPrivateKey(
	wallet.blockchainGroup(),
	account.address,
	YlideKeyVersion.KEY_V3,
	PrivateKeyAvailabilityState.AVAILABLE,
	{
		onPrivateKeyRequest: (address, magicString) => wallet.signMagicString(account, magicString),
	},
);
```

Now, key is ready. Let's add it to the registry (registry is automatically saved):

```ts
// Save the key in the storage again
await keyRegistry.addLocalPrivateKey(key);
```

Key is ready and available for usage.

## Registering communication key

First of all, let's check if this key had already been saved into the Ylide Registry:

```ts
const { freshestKey } = await ylide.core.getAddressKeys(account.address);
if (!freshestKey) {
	// There is no public key connected to this address in the Registry
} else {
	if (freshestKey.publicKey.equals(key.publicKey)) {
		// This key connected to this address in the Registry
	} else {
		// Another key connected to this address in the Registry
	}
}
```

If user's public key is not in the Registry - you should register it:

```ts
await wallet.attachPublicKey(account, key.publicKey.keyBytes, key.publicKey.keyVersion, 0);
```

Now, user can send and receive messages using Ylide Protocol.

## Sending message

First of all, let's build message's content:

```ts
const subject = 'Hello!';
const text = YMF.fromPlainText('Nice to meet you in Ylide :)');
```

Now, prepare the message content container:

```ts
const content = new MessageContentV5({
	sendingAgentName: 'generic',
	sendingAgentVersion: { major: 1, minor: 0, patch: 0 },
	subject,
	content: text,
	attachments: [],
	extraBytes: new Uint8Array(0),
	extraJson: {},
	recipientInfos: [
		new RecipientInfo({
			address: '0:86c4c21b15f373d77e80d6449358cfe59fc9a03e756052ac52258d8dd0ceb977',
			blockchain: '',
		}),
	],
});

const msgId = await ylide.core.sendMessage({
	wallet,
	sender: account,
	content,
	recipients: ['0:86c4c21b15f373d77e80d6449358cfe59fc9a03e756052ac52258d8dd0ceb977'],
});
```

Here we go. Message sent.

## Reading messages

First of all, let's instantiate sources:

```ts
const readingSession = new SourceReadingSession();

const sources = ylide.core.getListSources(readingSession, [
	{
		feedId: YLIDE_MAIN_FEED_ID, // main default mailing feed
		type: BlockchainSourceType.DIRECT, // direct messages (not broadcasts)
		recipient: blockchain.addressToUint256(account.address), // for your account
		sender: null, // from all senders (without filter by sender's address)
	},
]);

const messagesStream = new ListSourceDrainer(new ListSourceMultiplexer(sources.map(source => ({ source }))));

const newMessagesHandler = () => {};

const { dispose } = await messagesStream.connect('Reading mails', newMessagesHandler);
```

Now, when sources are connected, we can expect the first page of messages to be already loaded:

```ts
const message = this.stream!.messages[0].msg;
```

Let's load the content of the message:

```ts
const content = await ylide.core.getMessageContent(message);
if (!content || content.corrupted) {
	throw new Error('Content not found or corrupted');
}
```

Now, let's unpack and decrypt the container in which content of the message is stored:

```ts
const decodedContent = await ylide.core.decryptMessageContent(account, message, content);
```

Finally, we can easily access the content of the message:

```ts
alert(decodedContent.content.subject + '\n\n' + decodedContent.content.content.toPlainText());
```

Whoohoo!
