## Getting started

For all examples we will use Everscale connectors from `@ylide/everscale`.

So, first of all you should import these connectors:

```ts
import { everscaleBlockchainFactory, everscaleWalletFactory } from '@ylide/everscale';
```

Afterward, you should register them in the `Ylide` singleton:

```ts
Ylide.registerBlockchain(everscaleBlockchainFactory);
Ylide.registerWallet(everscaleWalletFactory);
```

You can easily verify availability of EverWallet in user's browser:

```ts
const isWalletAvailable = await everscaleWalletFactory.isWalletAvailable();
```

Then, let's instantiate `Ylide`, `YlideKeystore` with `BrowserLocalStorage`:

```ts
let provider;

const storage = new BrowserLocalStorage();
const keystore = new YlideKeyStore(storage, {
	// This handler will be called every time Keystore needs user's Ylide password
	onPasswordRequest: async (reason: string) => prompt(`Enter Ylide password for ${reason}:`),

	// This handler will be called every time Keystore needs derived signature of user's Ylide password
	onDeriveRequest: async (reason: string, blockchain: string, address: string, magicString: string) => {
		try {
			// We request wallet to sign our magic string - it will be used for generation of communication private key
			return provider.wallet.signMagicString(magicString);
		} catch (err) {
			return null;
		}
	},
});

await keystore.init();
```

So, our next step is to initialize Ylide, blockchain and wallet controllers:

```ts
const ylide = new Ylide(keystore);

provider = await Ylide.addWallet('everscale', 'everwallet');
```

Now, you can access both controllers as properties of the `provider` object.

## Initializing communication key

First of all, you should request access to the wallet account. Let's do this:

```ts
const account = await provider.wallet.requestAuthentication();
```

Now, we are ready for creation of our first communication key:

```ts
const ylidePassword = prompt(`Enter Ylide password for your first key:`);
if (!ylidePassword) {
	return;
}
const key = await keystore.create('For your first key', 'everscale', 'everwallet', account.address, ylidePassword);
```

Now, key is ready, encrypted and saved into the storage. To store it decrypted let's do the following:

```ts
// Switch key storage mode to decrypted
await key.storeUnencrypted(ylidePassword);
// Save the key in the storage again
await keystore.save();
```

Key is ready and available for usage.

## Registering communication key

First of all, let's check if this key had already been saved into the Ylide Registry:

```ts
const pk = await provider.blockchainController.extractPublicKeyFromAddress(account.address);
if (!pk) {
	// There is no public key connected to this address in the Registry
} else {
	if (pk.bytes.length === key.publicKey.length && pk.bytes.every((e, idx) => e === key.publicKey[idx])) {
		// This key connected to this address in the Registry
	} else {
		// Another key connected to this address in the Registry
	}
}
```

If user's public key is not in the Registry - you should register it:

```ts
await provider.wallet.attachPublicKey(key.publicKey);
```

Now, user can send and receive messages using Ylide Protocol.

## Sending message

First of all, let's build message's content:

```ts
const content = MessageContentV3.plain('Test subject', 'Hello Ylide world :)');
```

Now, send the message;

```ts
const msgId = await ylide.sendMessage({
	wallet: provider.wallet,
	sender: account,
	content,
	recipients: ['0:86c4c21b15f373d77e80d6449358cfe59fc9a03e756052ac52258d8dd0ceb977'],
});
```

Here we go. Message sent.

## Reading message

First of all, let's retrieve messages metadata from the blockchain:

```ts
const messages = await provider.blockchainController.retrieveMessageHistoryByDates(account.address);
```

Now, we have all the metadata: date, sender, recipient, key for decryption. But we hadn't loaded message content from the blockchain yet. So, let's do this:

```ts
const message = messages[0];

const content = await provider.blockchainController.retrieveAndVerifyMessageContent(message);
if (!content || content.corrupted) {
	throw new Error('Content not found or corrupted');
}
```

Now, let's unpack and decrypt the container in which content of the message is stored:

```ts
const decodedContent = await ylide.decryptMessageContent(message, content, account.address);
```

Finally, we can easily access the content of the message:

```ts
alert(decodedContent.subject + '\n\n' + decodedContent.content);
```

Whoohoo!
