import Ylide from '../';
import { describe, it, before } from 'mocha';
import { TestMessagingLayer, testMessagingState } from './TestBlockchainController';
import { AbstractMessagingLayer } from '../abstracts/AbstractWalletController';
import { expect } from 'chai';
import nacl from 'tweetnacl';
import { IGenericAccount } from '../types/IGenericAccount';

Ylide.(TestMessagingLayer);

// const instance = await Ylide.instantiateWallet(...);
// const account = await instance.getAuth();
// const recipient = await instance.getAccount('8:81929481');
// const content = await instance.formatters.Plain('hello world!');
// const richContent = await instance.formatters.Rich('{test: 123}');
// const

import { MessagePipeline } from '../content/MessageContainer';
import { MessageContentV3 } from '../content/MessageContentV3';
import { MessageBuilder } from '../content/MessageChunks';
import { SessionKey } from '../content/SessionKey';
import SmartBuffer from '@ylide/smart-buffer';

// // debugger;
// // const text = 'hello world :)';
// // const bytes = new TextEncoder().encode(text);
// // const compressed = compress(bytes as any);
// // const decompressed = decompress(compressed as any);
// // const decodedText = new TextDecoder().decode(decompressed);
// // console.log('decodedText: ', decodedText);
const text = `«Вы думаете, не догонит? Люди с Харькова приехали — догнались!»
На обочине, у выезда с улицы Маяковского в Белгороде, лежат охапки живых цветов. Сюда горожане несут их с утра — в память о погибших в результате ночного обстрела.

Рядом с импровизированным мемориалом — многоэтажный дом, окруженный красно-белыми лентами МЧС. Оконные рамы в нем теперь пустые. Нет и стоявшего раньше по соседству частного дома — от него остались только обломки. Следующий дом — тоже частный — поврежден меньше; у него нет только крыши.

Серия взрывов в Белгороде, утверждает министерство обороны РФ, была «преднамеренным ударом» ВСУ баллистическими ракетами «Точка-У» с кассетными боеприпасами. По официальной версии, средства ПВО уничтожили все три ракеты в воздухе, но обломки одной из них упали на жилой дом по улице Маяковского. В результате погибли люди, в том числе четверо граждан Украины. Следственный комитет возбудил уголовное дело по факту обстрела города.

Полицейский «Форд» перекрыл въезд на улицу Маяковского. Во дворе одной из соседних многоэтажек лежит груда треснувших, вырванных с корнем оконных рам. А на первом этаже мужчина с голым торсом оклеивает пластиковой пленкой свой балкон. «Это не мои, — говорит он корреспонденту, кивая на рамы под балконом, — Это выше».

О ночных взрывах белгородец знает только «со слов». «„Точку-У“ сбили. Кусок упал на дом. Трое погибли. Вроде как четвертого откопали. С Харькова», — пересказывает он. И признается: «Страшно, но что делать?» А на вопрос, собирается ли теперь уехать из города, отвечает сухо: «Видно будет».

По двору ходят полицейские и сотрудники МЧС, пока рабочие — на них нет специальной формы — с громким лязгом бросают в мусорный контейнер стекла. Из подъезда одного из поврежденных многоквартирных домов выходят двое мужчин — на одном синяя жилетка спасательной службы, в руках у другого — блокнот.

— Так, ну пойдем отчитаемся? — спрашивает тот, что с блокнотом.

— Да какой! Кофе пошли попьем, — отвечает ему напарник в синей жилетке.

Дальше по улице — снова красно-белая лента, она окружает еще один частный дом с выбитыми окнами и сорванным шифером. Перед лентой — толпа. Сложив руки за спиной, из стороны в сторону качается мальчик в голубой футболке с буквой Z на груди. Полицейский застенчиво бродит по периметру оцепления и встает с краю. Когда кто-то достает телефон, он негромко чеканит: «Съемка данного объекта в настоящее время запрещена».

«Очень болезненно», — рассказывает о том, как пережила эту ночь, корреспонденту женщина, сидящая на скамейке неподалеку. Добавляет: «Вы же это не пережили!» И эмоционально объясняет, почему не видит смысла, куда-либо уезжать из Белгорода: «Вы думаете, не догонит? Люди с Харькова приехали — догнались! А вы спрашиваете „уехать“».

ЧТО ИЗВЕСТНО О ВЗРЫВАХ В БЕЛГОРОДЕ
Из-за взрывов в центре Белгорода повреждены десятки жилых домов. Погибли четыре человека Минобороны РФ заявило об ударе по городу украинскими ракетами
«Остались в живых только мама и брат»
Обломки «Точки-У», которую по утверждению российских властей сбили ПВО и которую обсуждают белгородцы, ночью 3 июля попали в частный дом на улице Маяковского, 25. В это время в доме находились семь человек, включая четверых беженцев из Харьковской области. Выжили только двое, говорит родственница погибших Илона (она попросила не указывать ее фамилию).

«Я спала, когда мне позвонил папа где-то в четыре утра, — вспоминает Илона, которая сейчас живет в Воронеже. — Он был с братом в больнице — у того осколок в глазу, его оперировали. Сказал, что снаряд взорвался во дворе в доме мамы. Когда я дозвонилась до мамы, она сказала, что мой отчим Артем (имя изменено) и вся его семья погибли. Остались в живых только мама и брат».`;

(async () => {
	// globally exists
	const myAddress = '0:86c4c21b15f373d77e80d6449358cfe59fc9a03e756052ac52258d8dd0ceb977';
	const recipientKey = nacl.box.keyPair();
	const myPrivateWalletKeypair = nacl.sign.keyPair();

	// on session initiation
	const sessionKeyPair = SessionKey.generateKeyPair();
	const sessionPublicKeySign = await SessionKey.signPublicKey(sessionKeyPair.publicKey, async key => {
		return nacl.sign.detached(key, myPrivateWalletKeypair.secretKey);
	});

	const recipients = [
		{
			address: '0:86c4c21b15f373d77e80d6449358cfe59fc9a03e756052ac52258d8dd0ceb977',
			publicKey: new SmartBuffer(recipientKey.publicKey).toHexString(),
		},
		{
			address: '0:dc0e6248fa1f599fd1c2ac40d3ba2342d6eaaac4b19767063f939997dcbc66c2',
			publicKey: new SmartBuffer(recipientKey.publicKey).toHexString(),
		},
	];

	const msg = MessageContentV3.plain('hello subject', text);
	const result = MessagePipeline.encodeContentV2(msg);
	const recipientKeys = recipients.map(({ address, publicKey }) => {
		const encData = SessionKey.encryptData(result.key, SmartBuffer.ofHexString(publicKey).bytes, sessionKeyPair);
		return {
			address,
			key: SessionKey.packDataNonce(encData.encryptedData, encData.nonce),
		};
	});

	const chunks = MessageBuilder.packContentInChunks(
		[0, 0, 0, 0],
		sessionKeyPair.publicKey,
		sessionPublicKeySign,
		result.content,
	);

	console.log('Done in chunks: ', chunks);

	const recipientContentKey = recipientKeys.find(t => t.address === myAddress)!;
	const dec = MessageBuilder.unpackContentFromChunks(chunks);
	if (
		!SessionKey.verifySessionKey(dec.sessionPublicKey, dec.sessionPublicKeySign, myPrivateWalletKeypair.publicKey)
	) {
		console.log('Session key verification failed');
		return;
	}
	const dataNonceMyKey = SessionKey.unpackDataNonce(recipientContentKey.key);
	const decodedMyKey = nacl.box.open(
		dataNonceMyKey.data,
		dataNonceMyKey.nonce,
		dec.sessionPublicKey,
		recipientKey.secretKey,
	)!;
	const deccon = MessagePipeline.decodeContentV2(dec.content, decodedMyKey);
	console.log('deccon: ', deccon);
})();

// describe('Ylide', () => {
// 	describe('Accounts', () => {
// 		let wallet: AbstractMessagingLayer;
// 		before(async () => {
// 			wallet = await Ylide.instantiateWallet(TestMessagingLayer);
// 		});
// 		it('check no auth', async () => {
// 			const auth = await wallet.getAuth();
// 			expect(auth).equal(null);
// 		});
// 		it('auth fail', async () => {
// 			testMessagingState.requestAuthHandler = async () => {
// 				return null;
// 			};
// 			const auth = await wallet.requestAuthentication();
// 			expect(auth).equal(null);
// 		});
// 		it('auth success', async () => {
// 			testMessagingState.requestAuthHandler = async () => {
// 				return testMessagingState.account;
// 			};
// 			const auth = await wallet.requestAuthentication();
// 			expect(auth).not.equal(null);
// 		});
// 		it('check auth', async () => {
// 			const auth = await wallet.getAuth();
// 			expect(auth).not.equal(null);
// 		});
// 		it('disconnect auth', async () => {
// 			await wallet.disconnectAccount();
// 			const auth = await wallet.getAuth();
// 			expect(auth).equal(null);
// 		});
// 	});
// 	describe('Messages', () => {
// 		let wallet: AbstractMessagingLayer;
// 		let acc: IGenericAccount;
// 		let msgId: string;
// 		before(async () => {
// 			wallet = await Ylide.instantiateWallet(TestMessagingLayer);
// 			testMessagingState.requestAuthHandler = async () => {
// 				return testMessagingState.account;
// 			};
// 			acc = (await wallet.requestAuthentication())!;
// 		});
// 		it('send message', async () => {
// 			const result = await wallet.sendMessage('test', acc, testMessagingState.anotherAccount);
// 			expect(result).not.equal(null);
// 			expect(result).to.be.a('string');
// 			msgId = result!;
// 		});
// 		it('retrieve message', async () => {
// 			const msg = await wallet.retrieveMessageById(msgId);
// 			expect(msg).not.equal(null);
// 			expect(msg!.body).equal('test');
// 		});
// 		after(async () => {
// 			await wallet.disconnectAccount();
// 		});
// 	});
// });
