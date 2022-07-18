# Basic concepts | Ylide

### <a name="glossary"></a>**Glossary**

**Wallet keys** - a pair of private and public keys from the user's blockchain wallet. Using the private key of the wallet, the user signs her transactions in the blockchain network (and, accordingly, manages her funds). Traditionally, these are Ed25519 keys and can only be used to sign the data, not to encrypt it.

**Communication keys** - a pair of the user's private and public keys (x25519 standard), with which the user encrypts and decrypts messages. The communication public key is known to everyone since it’s published on the blockchain by the user). The communication private key is known only by the user.

**Ylide password** - a secret password created by the user in Ylide. It is used to access his communication private key on any device by only signing with his wallet (MetaMask/Phantom/Coinbase Wallet/etc.).

**Session** - from the moment when the user opened the application until the moment when he closed it. An application can be called either a regular application for a computer/smartphone or a dApp running in a browser tab. In the former case, closing the tab is the end of the session.

## <a name="keys-init"></a>**Initialization of communication keys**

In classical key generation schemes, the private key is generated as a random set of bytes, and the public key is calculated based on the private key. This method is great for generating wallet keys but it is inconvenient for communication keys since:

-   if the communication keys are completely independent and separate from the wallet, then the user needs to monitor two pairs of keys at once, take care of their security, and also manually transfer them to new devices from which she wants to communicate through the protocol Ylide;
-   the wallet key cannot always be used for end-to-end encryption of messages;
-   the wallet key is strictly private information that the user should never give access to external applications;
-   most of the current non-custodial digital wallet doesn’t support the operation of encryption;
-   some users use hardware wallets (ledgers), in this case, it is physically impossible to get access to the private key of the wallet.

However, absolutely all wallet key formats, even in the most diverse and non-standard blockchains and cryptographic schemes, can sign data. This is their main property - the key to a blockchain wallet must be able to sign transactions - therefore, signing data is included in the arsenal of the capabilities of any wallet.

Data signing can only be done by the owner of the private key. At the same time, it is impossible to calculate the private key from the signature.

Hence the scheme of the derivation of the private communication key from the private key of the user's wallet was born.

The scheme is simple: we take a fixed string, request the signature of this string from the user's wallet, and get a unique and unknown (secret) signature. From this signature, we can calculate the hash (which will also be known to anyone) and use it as a communication private key.

However, it creates security risks - since the string is fixed and known in advance, an attacker could ask the user to sign this string on any other website with their wallet. The user, not noticing the catch, could confirm such an operation. In this case, the attacker would take possession of this secret signature and would gain access to the communication private key.

Therefore, to make such an attack impossible, we decided to make the string dynamic rather than fixed. To do this, we introduce the concept of “Ylide password” - this is a password (random string) that the user himself comes up with and remembers. And now, instead of a fixed string, we use a dynamic one: “fixed string + user password” from which the signature and the communication private key are created.

Now to steal your communication key, an attacker will have to first ask you to enter your Ylide password, and only then ask you for a signature. This drastically reduces the risk of an attack - when on an unfamiliar website you are suddenly asked to give your Ylide password - you will pay attention to this, think about it, and prevent the fraud.

## <a name="keys-storage"></a>**Storage of communication keys**

As noted above, to gain access to the communication key, we need two components:

-   Ylide password created by the user;
-   "fixed string + ylide password" signed by his wallet (in the data signing request).

Surely, asking for each operation inside the application to enter two passwords (Ylide and signing request) creates a weak User Experience.

Therefore, in the standard scheme, immediately after generating a communication key, Ylide SDK encrypts it using the same password, and stores it in the user's local storage.

Then to confirm any message, it is enough for the user to specify only one password. It's more comfortable but still not the best.

Therefore, the Ylide SDK provides several scenarios with different levels of security, so that users can choose the most suitable option.

### <a name="keys-storage-local-session-decrypted"></a>**1. Storing communication key in memory in clear text (for one session), and in local storage - in encrypted form**

When prompted for a Ylide password, the user is provided with an option to “remember for this session”. As a result, the user's password will be stored in the RAM until the end of the session. The communication key will be encrypted and stored in the local storage.

This will allow the user to read (decrypt) emails without entering any passwords. To send a letter, the user will only need to confirm transaction to broadcast the message to the blockchain.

To steal and decrypt the communication key, an attacker would need to hijack the user's device or browser and gain access to RAM, which is very difficult and has a low probability of attack.

### <a name="keys-storage-local-days-decrypted"></a>**2. Storing communication key in the local storage in clear text (for several days)**

The user can choose “remember for 5 days” option. The user's password will be stored in the local storage, and even if the user closes the application or browser, he will not have to specify the password the next time he logs in. After a few days, the Ylide SDK will remove this password from storage and ask you to enter it again.

As in the previous version, this will allow you to read letters without passwords, and send them only with a wallet confirmation.

Similarly, to steal and decrypt the communication key, an attacker would need to access the memory of the user's device, and this is extremely high complexity and low probability of attack.

### <a name="keys-storage-local-encrypted"></a>**3. Storing communication key in the local storage in encrypted form**

The communication key will be stored in local storage, but encrypted with the Ylide password.

In this case, the user will have to additionally enter the Ylide password to read and send every email.

To steal and decrypt the communication key, an attacker will need to gain access to the device's memory to get the encrypted communication key and then to the RAM to intercept the Ylide password. This is an extremely high difficulty and a very low chance of being attacked.

### <a name="keys-storage-paranoid"></a>**4. Paranoid mode: don't store the communication key at all**

For each read and send, the user will have to enter both the Ylide password and his wallet's password. The key will appear in the RAM only for a moment necessary to proceed with the message. After it is immediately erased from the RAM.

In this case, to steal and decrypt the communication key, an attacker will need to gain access to the device's RAM and intercept both the encrypted communication key and Ylide password in the key derivation process at the right time. This is a phenomenally high difficulty and an extremely low attack probability.

## <a name="crypto"></a>**Cryptographic primitives**

Ylide SDK uses the x25519-xsalsa20-poly1305 algorithm to encrypt and decrypt messages using communication keys. This scheme involves access to the sender's private key as well as the recipient's public key. Using the Diffie-Hellman scheme, a one-time secret key is exchanged securely, with which the necessary information is encrypted. The recipient, using his private key and the sender's public key, can decrypt the received information.

Under this scheme, both the private and public keys take up 32 bytes. **Nonce** - random data that is mixed into the content of encrypted passwords, takes up 24 bytes.

**sha256** is used to hash the signature and takes up 32 bytes.

For all cryptographic primitives in the Ylide SDK, the **NaCl** library is used, namely its implementation [TweetNaCl](https://www.npmjs.com/package/tweetnacl). This library passed an independent security audit by Cure53 in 2017 and is considered reliable.

## <a name="sending-reading"></a>**Sending and reading messages**

Sending: To send a message, Ylide SDK uses a two-step encryption system to save memory and transaction size, which are paid on blockchains. In the first stage, the Ylide SDK generates a one-time random symmetric key, the so-called “content password”, with which the content of the message is encrypted and uploaded to the blockchain.

Everyone can see the encrypted content, but no one can decrypt it without the "content password".

In the second stage, for each recipient, Ylide SDK:

-   gets the communication public key from the registry (Ylide smart contract on the blockchain);
-   encrypts the "content password" with the sender's communication private key;
-   encrypts with the Diffie-Hellman scheme.

**The resulting encrypted "content password" (including an additional random nonce) takes up 100 bytes, which is drastically less than if Ylide would send each recipient a copy of the entire message.**

All "content passwords" are uploaded to the blockchain.

Receiving: For the receiving party, the process is reversed. Ylide SDK:

-   "Notices" the appearance of a new message in the blockchain for the recipient;
-   Downloads the "content password" and encrypted content of the message from the blockchain;
-   Decrypts the "content password" from the message using the private communication key of the recipient and the public communication key of the sender.

After that, the content of the message is decrypted and becomes available for reading by the recipient.

The scheme described above is an evolution of the classic end-to-end encryption scheme for an environment where data saving is important.

An additional advantage of this scheme is that if the sender, after some time, wants to share the content of the message with another recipient (for example, a new subscriber to his paid mailing list), he will simply send the encrypted "content password" to this recipient. There is no need to upload the content to the blockchain once again.

## <a name="keys-registry"></a>**Register of public keys**

One of the important elements of the scheme described above is the register of public communication keys of users. Since to send a message the sender needs to know the recipients' communication public key - this register (or registry) is necessary for communication. At the same time, the fact that the user's public key is available to everyone does not bear any risks. The public key is precisely called "public" because it can be transferred to an unlimited circle of people. It is impossible to restore a private key based on a public one.

As part of the Ylide Smart Contracts, we provide a different version of the ledger smart contract for each blockchain. However, they all perform the same functions:

-   store the “wallet address” ⇒ “communication public key” link (or pair).
-   store the “communication public key” ⇒ “wallet address” link (or pair).

The second link is not necessary but allows to verify the senders' old emails if for some reason they had to change the communication private key (for example, in case of losing a password).

Important to note that the communication public key is passed to the transaction in an explicit (decrypted) form. Therefore, an attacker can substitute any other information instead of a real public key.

However, the wallet address in the smart contract is read from the transaction itself so the attacker will not be able to substitute your address in any way (unless he has access to your wallet). This guarantees security in the link “wallet address” ⇒ “communication public key” - only the real owner of the wallet will be able to derive the public communication key for his address.

In the “communication public key” ⇒ “wallet address” link, an attacker can write his address to someone else's public communication key. However, this will not lead to any result. The attacker won't be able to:

-   read your messages - he has no communication private key;
-   write letters on your behalf - he has no wallet private key.

The only scenario in which this will cause inconvenience: if a user has lost his old Ylide password and created a new one (and, accordingly, a new private communication key). Then next to the old messages from this user, recipients will see a “This message is encrypted with a key, which does not match the current or previous sender keys. Be careful".

In future versions, we plan to add a mechanism for checking the public key on upload to the “communication public key” ⇒ “wallet address” link (or pair), which will remove the drawback described above. However, even now it does not bear any risks.

## <a name="smart-contracts"></a>**The architecture of smart contracts and interaction with the blockchain**

> The architecture of smart contracts may differ depending on the technologies and tools available in each particular blockchain. This block describes the architecture for EVM and EVM-compatible blockchains.

In the minimum required version, Ylide uses 2 smart contracts to ensure communication between users:

1. The first smart contract is a register that stores the “wallet address” ⇒ “communication public key” link (or pair). Please see more details on how it works and why it's required in the "Register of public keys" section.
2. The second is a broadcasting smart contract. It is responsible for uploading the encrypted content of letters to the blockchain and “notifications” of the message that contains the encrypted "content password".

Both smart contracts do not require access to the information that is uploaded to them. In other words, the information does not become the “internal state” of smart contracts but rather stored in the event system. This saves space and greatly reduces the cost of a transaction since we don't use any global arrays or mappings inside smart contracts to store data.

Each message has a unique **msgId** - message identifier that is used to quickly find its content on the blockchain.

There are 2 streams of events: the first is content, and the second is notifications to recipients with decryption keys.

1. Content stream - the encrypted content of the message stored in the events and each event has an indexed field **msgId** used to quickly find the content. The content itself can be divided into several parts, i.e. several events will be generated with the same indexed **msgId** but different content. Decrypting a message without access to all parts is impossible. All parts are connected by the Ylide SDK in the user application.
2. Notification stream \***\*- \*\***the generated events contain the indexed address of the recipient, **msgId** of the message, and the "content password" encrypted for the particular recipient.

The separation of these two streams has several goals at once:

-   No need to download the full content of emails from the blockchain to show the user a full list of messages or notify about new messages.
-   In the future, for large messages with media content, content events can be stored not on the blockchain but in external decentralized storages such as IPFS, Arweave, FileCoin and etc. This will allow to further reduce the cost of messages keeping the fact that the message was sent.
-   Allows sharing the content of the message with new recipients even after the message is sent.

Now let's take a look at the detailed process of receiving messages from the Ylide SDK:

1. The application defines a list of blockchains from which it wants to display messages to the user.
2. For each of these blockchains, either a subscription to notification events with a filter by the recipient's address (which is indexed) or a periodic request for these events (if the subscription is not available) is established.
3. When a new message appears - it is displayed in the user interface, with information about the date, sender, and other meta information. Inside the application, **msgId** is stored for this message.
4. If the user wants to read the message, Ylide SDK sends a request to the specific blockchain (where the message was sent) for content events with a filter by **msgId** (indexed). As a result, the Ylide SDK downloads all parts of the message in encrypted form and combines them into one.
5. Next, depending on the security level chosen by the user, Ylide SDK either immediately decrypts the content of the message using the user's communication private key or asks him for the necessary passwords, after which the message is decrypted.
6. The decrypted content is displayed to the user on the screen.

## <a name="faq"></a>**FAQ**

**Q: The user entered the wrong Ylide password. What will happen?**

A: Ylide SDK will derivate the private communication key using the wrong password and get a new pair of communication keys. After that, the SDK will make a request to the registry contract and see that the communication public key that the user saved earlier does not match the new communication public key received as a result of the derivation. A password error message will be displayed.

**Q: User forgot Ylide password. What will happen?**

A: Since the Ylide Protocol is completely decentralized for security reasons and the user's password is not stored anywhere, we cannot help him to recover it. However, the user will be able to create a new password to generate new communication keys and continue correspondence from the same address. In this case, the user will not be able to read the content of old messages. He will be able to read the content of new messages only (sent to him after updating the communication public key in the register).

**Q: An attacker stole the user's Ylide password. What will happen?**

A: Nothing. The Ylide password is used as the second factor in our authentication system, so without access to the private key from the user's wallet, an attacker will not be able to read or write messages on behalf of the user. However, with the Ylide password, it will be easier for an attacker to obtain a signature from the user to create a communication private key, so if the password is lost, Ylide recommends immediately changing it to a new one. At the same time, the content of old messages will not be available to the attacked (only to the user).

**Q: An attacker has stolen the user's private communication key. What will happen?**

A: The attacker will be able to read the messages that were written to this user but will not be able to write letters on his behalf (as this will require the wallet's private key). In this case, the user will have to create a new Ylide password and continue communication without any risks afterward.

**Q: An attacker has stolen the user's private wallet key. What will happen?**

A: Truth be told, if a user's private wallet key is stolen, communication risks are the least of his concerns. However, even in such a dramatic scenario, if the attacker does not have the Ylide password, he will not be able to read old emails. However, he will be able to generate a new password, and, accordingly, a new communication key, register it in the registry, and correspond on behalf of the user.
