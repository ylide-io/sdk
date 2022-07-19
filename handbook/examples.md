## Getting started

For all examples we will use Everscale connectors from `@ylide/everscale`.

So, first of all you should import these connectors:

```ts
import { EverscaleReadingController, EverscaleSendingController } from '@ylide/everscale';
```

Afterward, you should register them in the `Ylide` singleton:

```ts
Ylide.registerReader(EverscaleReadingController);
Ylide.registerSender(EverscaleSendingController);
```

You can easily verify availability of EverWallet in user's browser:

```ts
const isWalletAvailable = await EverscaleSendingController.isWalletAvailable();
```

So, our next step is to initialize sending and reading controllers:

```ts
const provider = await Ylide.instantiateWallet(EverscaleSendingController, EverscaleReadingController);
```

Now, you can access both controllers as properties of the `provider` object.

## Initializing communication key

First of all, you should request access to the wallet account. Let's do this:

```ts
const account = await provider.sender.requestAuthentication();
```

Then, let's instantiate `YlideKeystore` with `BrowserLocalStorage`:

```ts
const storage = new BrowserLocalStorage();
const keystore = new YlideKeyStore(storage, {
	// This handler will be called every time Keystore needs user's Ylide password
	onPasswordRequest: async (reason: string) => prompt(`Enter Ylide password for ${reason}:`),

	// This handler will be called every time Keystore needs derived signature of user's Ylide password
	onDeriveRequest: async (reason: string, blockchain: string, address: string, magicString: string) => {
		try {
			// We request wallet to sign our magic string - it will be used for generation of communication private key
			return provider.sender.deriveMessagingKeypair(magicString);
		} catch (err) {
			return null;
		}
	},
});

await keystore.init();
```

Now, we are ready for creation of our first communication key:

```ts
const ylidePassword = prompt(`Enter Ylide password for your first key:`);
if (!ylidePassword) {
	return;
}
const key = await keystore.create('For your first key', 'everscale', account.address, ylidePassword);
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
const pk = await provider.reader.extractPublicKeyFromAddress(account.address);
if (!pk) {
	// There is no public key connected to this address in the Registry
} else {
	if (pk.length === key.publicKey.length && pk.every((e, idx) => e === key.publicKey[idx])) {
		// This key connected to this address in the Registry
	} else {
		// Another key connected to this address in the Registry
	}
}
```

If user's public key is not in the Registry - you should register it:

```ts
await provider.sender.attachPublicKey(key.publicKey);
```

Now, user can send and receive messages using Ylide Protocol.

## Sending message

First of all, let's build message's content:

```ts
const content = MessageContentV3.plain('Test subject', 'Hello Ylide world :)');
```

Now, we should get public key of the recipient;

```ts
const recipient = '0:86c4c21b15f373d77e80d6449358cfe59fc9a03e756052ac52258d8dd0ceb977';
// Get recipient communication public key from the Registry:
const recipientPublicKey = await provider.reader.extractPublicKeyFromAddress(recipient);

if (!recipientPublicKey) {
	throw new Error('Recipient public key not found');
}

// Now we execute boxed function with decrypted keypair:
await key.execute('Sending message', async keypair => {
	await provider.sender.sendMessage(YLIDE_SC, keypair, content, [
		{
			address: recipient,
			publicKey: recipientPublicKey,
		},
	]);
});
```

Here we go. Message sent.

## Reading message

First of all, let's retrieve messages metadata from the blockchain:

```ts
const messages = await provider.reader.retrieveMessageHistoryByDates(account.address);
```

Now, we have all the metadata: date, sender, recipient, key for decryption. But we hadn't loaded message content from the blockchain yet. So, let's do this:

```ts
const message = messages[0];

const content = await provider.reader.retrieveAndVerifyMessageContent(message);
if (!content || content.corrupted) {
	throw new Error('Content not found or corrupted');
}
```

Now, let's unpack the container in which content of the message is stored:

```ts
const unpackedContent = await MessageChunks.unpackContentFromChunks([content.content]);
```

And, let's decrypt the message key:

```ts
let symmKey;
// We execute boxed function again to decrypt the key of the message
await key.execute('Read message', async keypair => {
	symmKey = keypair.decrypt(message.key, unpackedContent.publicKey);
});
if (!symmKey) {
	throw new Error('Decryption key is not accessable');
}
```

Finally, we can easily decrypt the content of the message using this key:

```ts
const decodedContent = MessageContainer.decodeContent(unpackedContent.content, symmKey);
alert(decodedContent.subject + '\n\n' + decodedContent.content);
```

Whoohoo!
