/* tslint:disable */
// import { BlockchainSourceType } from './cross-chain';
// import { ListSource } from './cross-chain/new-list/ListSource';
// import { ListSourceDrainer } from './cross-chain/new-list/ListSourceDrainer';
// import { IMessageWithSource, ListSourceMultiplexer } from './cross-chain/new-list/ListSourceMultiplexer';
// import { PuppetListSource } from './cross-chain/new-list/PuppetListSource';
// import { ScriptedSource, tou } from './cross-chain/new-list/ScriptedSource';
// import { SourceReadingSession } from './cross-chain/new-list/SourceReadingSession';
// import { Uint256 } from './types';
// import { asyncDelay } from './utils/asyncDelay';

// function g(m: IMessageWithSource[]) {
// 	return m.map(s => s.msg.createdAt);
// }

// (async () => {
// 	const s = new SourceReadingSession();
// 	const aBase =
// 		'300 295 290 285 280 275 270 265 260 255 250 245 240 235 230 225 220 215 210 205 100 195 190 185 180 175 170 165 160 155 150 145 140 135 130 125 120 115 110 105 100 95 90 85 80 75 70 65 60 55 50 45 40 35 30 25 20 15 10 5';
// 	const a = new ScriptedSource(aBase, [
// 		// {
// 		// 	vals: [305, 304, 303, 302, 301],
// 		// 	delay: 2000,
// 		// },
// 	]);
// 	// const b = new ScriptedSource(
// 	// 	aBase
// 	// 		.split(' ')
// 	// 		.map(v => parseInt(v) - 1)
// 	// 		.join(' '),
// 	// 	[
// 	// 		{
// 	// 			vals: [471, 450, 381],
// 	// 			delay: 1500,
// 	// 		},
// 	// 	],
// 	// );
// 	// const c = new ScriptedSource('113 108 103 98 93 88 83', [
// 	// 	{
// 	// 		vals: [446, 445, 444, 443],
// 	// 		delay: 1800,
// 	// 	},
// 	// ]);
// 	const listA = new ListSource(
// 		s,
// 		{ type: BlockchainSourceType.DIRECT, recipient: tou('recipient'), sender: null, blockchain: 'A' },
// 		a,
// 	);
// 	const listB = new PuppetListSource(
// 		s,
// 		{ type: BlockchainSourceType.DIRECT, recipient: tou('recipient'), sender: tou('456'), blockchain: 'B' },
// 		listA,
// 	);
// 	const listC = new PuppetListSource(
// 		s,
// 		{ type: BlockchainSourceType.DIRECT, recipient: tou('recipient'), sender: tou('789'), blockchain: 'C' },
// 		listA,
// 	);
// 	// const listB = new ListSource(
// 	// 	s,
// 	// 	{ type: BlockchainSourceType.DIRECT, recipient: tou('123456'), sender: null, blockchain: 'B' },
// 	// 	b,
// 	// );
// 	// const listC = new ListSource(
// 	// 	s,
// 	// 	{ type: BlockchainSourceType.DIRECT, recipient: tou('12345679'), sender: null, blockchain: 'C' },
// 	// 	c,
// 	// );
// 	const m = new ListSourceMultiplexer([listB, listC]);
// 	const d = new ListSourceDrainer(m);
// 	d.on('messages', async ({ messages }: { messages: IMessageWithSource[] }) => {
// 		console.log('acha: ', g(messages));
// 	});
// 	// d.resetFilter(l => l.msg.createdAt % 2 === 0);
// 	await d.resume();
// 	const firstPage = await d.readMore(10);
// 	console.log('firstPage: ', g(firstPage), d.drained);
// 	console.log('before delay');
// 	await asyncDelay(3000);
// 	console.log('after delay: ', g(d.messages));
// 	const secondPage = await d.readMore(10);
// 	console.log('secondPage: ', g(secondPage), d.drained);
// 	const thirdPage = await d.readMore(10);
// 	console.log('thirdPage: ', g(thirdPage), d.drained);
// 	await d.resetFilter(l => l.msg.createdAt % 3 === 0);
// 	const firstAfterResetPage = await d.readMore(10);
// 	console.log('firstAfterResetPage: ', g(firstAfterResetPage), d.drained);
// 	debugger;
// })();

// (async () => {
// 	const pushId = encodePushId(
// 		123456789,
// 		101,
// 		12,
// 		// '84728572856284618496826495673627485284817395718f71836481723739bb' as Uint256,
// 	);

// 	console.log('pushId: ', pushId);

// 	const decoded = decodePushId(pushId);

// 	console.log('decoded: ', decoded);

// 	const contentId = '000001410003025895f65219bd764908be2972155bb285e34cdd54a48fac6100' as Uint256;

// 	const decodedContentId = decodeContentId(contentId);

// 	console.log('decodedContentId: ', decodedContentId);

// 	debugger;
// })();
