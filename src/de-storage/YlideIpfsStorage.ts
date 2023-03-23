export const YLIDE_IPFS_NODE = 'https://ipfs.ylide.io';

export class IpfsStorage {
	nodeUrl: string = YLIDE_IPFS_NODE;

	async uploadToIpfs(data: Uint8Array) {
		const formData = new FormData();

		formData.append('file', new Blob([data]));

		const response = await fetch(this.nodeUrl, {
			method: 'POST',
			body: formData,
		});

		const json = await response.json();

		return {
			hash: json.Hash as string,
			size: parseInt(json.Size, 10),
		};
	}

	async downloadFromIpfs(hash: string) {
		const response = await fetch(`${this.nodeUrl}/file/${hash}`);

		const data = await response.arrayBuffer();

		return new Uint8Array(data);
	}
}
