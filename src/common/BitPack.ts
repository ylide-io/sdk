// Inefficent as hell, but it works

import SmartBuffer from '@ylide/smart-buffer';

export class BitPackWriter {
	private buffer = '';

	writeBits(value: number | bigint, bitLength: number) {
		if (bitLength > 32) {
			throw new Error('Cannot write more than 32 bits at once');
		}
		if (bitLength < 0) {
			throw new Error('Cannot write negative bits');
		}
		if (bitLength === 0) {
			return;
		}
		if (value >= 2 ** bitLength) {
			throw new Error('Cannot write more bits than the value has');
		}
		if (value < 0) {
			throw new Error('Cannot write negative bits');
		}
		const bits = value.toString(2).padStart(bitLength, '0');
		this.buffer += bits;
	}

	writeUint8(value: number) {
		this.writeBits(BigInt(value), 8);
	}

	writeUint16(value: number) {
		this.writeBits(BigInt(value), 16);
	}

	writeUint32(value: number) {
		this.writeBits(BigInt(value), 32);
	}

	writeUint64(value: bigint) {
		this.writeBits(value, 64);
	}

	writeUintVariableSize(value: number) {
		if (value < 256) {
			this.writeBits(0n, 2);
			this.writeBits(BigInt(value), 8);
		} else if (value < 65536) {
			this.writeBits(1n, 2);
			this.writeBits(BigInt(value), 16);
		} else if (value < 16777216) {
			this.writeBits(2n, 2);
			this.writeBits(BigInt(value), 24);
		} else {
			this.writeBits(3n, 2);
			this.writeBits(BigInt(value), 32);
		}
	}

	writeBit(value: number) {
		this.writeBits(BigInt(value), 1);
	}

	writeBytes(bytes: Uint8Array) {
		for (const byte of bytes) {
			this.writeUint8(byte);
		}
	}

	toBuffer(): Uint8Array {
		const bytes: number[] = [];
		const alignedBuffer =
			this.buffer.length % 8 === 0 ? this.buffer : '0'.repeat(8 - (this.buffer.length % 8)) + this.buffer;
		for (let i = 0; i < alignedBuffer.length; i += 8) {
			bytes.push(parseInt(alignedBuffer.substring(i, i + 8), 2));
		}
		return new Uint8Array(bytes);
	}

	toHex(prefix = false) {
		return (prefix ? '0x' : '') + this.toBuffer().reduce((acc, v) => acc + v.toString(16).padStart(2, '0'), '');
	}
}

export class BitPackReader {
	private buffer = '';
	private bitOffset = 0;

	static fromBuffer(buffer: Uint8Array, shrinked = false) {
		return new BitPackReader(buffer, shrinked);
	}

	static fromHex(hex: string, shrinked = false) {
		return new BitPackReader(SmartBuffer.ofHexString(hex.replace('0x', '')).bytes, shrinked);
	}

	private constructor(private bytes: Uint8Array, shrinked = false) {
		this.buffer = bytes.reduce((acc, v) => acc + v.toString(2).padStart(8, '0'), '');
		if (shrinked) {
			let leadingZeros = 0;
			for (const bit of this.buffer) {
				if (bit === '0') {
					leadingZeros++;
				} else {
					break;
				}
			}
			this.buffer = this.buffer.substring(leadingZeros);
		}
	}

	readBits(bitLength: number) {
		if (bitLength > 32) {
			throw new Error('Cannot read more than 32 bits at once');
		}
		if (bitLength < 0) {
			throw new Error('Cannot read negative bits');
		}
		if (bitLength === 0) {
			throw new Error('Cannot read zero bits');
		}
		if (this.bitOffset + bitLength > this.buffer.length) {
			throw new Error('Cannot read more bits than the buffer has');
		}
		const value = parseInt(this.buffer.substring(this.bitOffset, this.bitOffset + bitLength), 2);
		this.bitOffset += bitLength;
		return value;
	}

	readUint8() {
		return this.readBits(8);
	}

	readUint16() {
		return this.readBits(16);
	}

	readUint32() {
		return this.readBits(32);
	}

	readUint64() {
		const hi = this.readBits(32);
		const lo = this.readBits(32);
		// eslint-disable-next-line no-bitwise
		return (BigInt(hi) << 32n) | BigInt(lo);
	}

	readBit() {
		return this.readBits(1);
	}

	readUintVariableSize() {
		const header = this.readBits(2);
		if (header === 0) {
			return this.readBits(8);
		} else if (header === 1) {
			return this.readBits(16);
		} else if (header === 2) {
			return this.readBits(24);
		} else {
			return this.readBits(32);
		}
	}

	readBytes(length: number) {
		const bytes = new Uint8Array(length);
		for (let i = 0; i < length; i++) {
			bytes[i] = this.readUint8();
		}
		return bytes;
	}
}

// test-example:
/*
const writer = new BitPackWriter();
const accountHash3Bytes = 12345;
const blockNumber4bytes = 54321;
const txIndex2bytes = 123;
const logIndex2bytes = 111;
const contentIdUint256 = '0x123456123123123';
*/
