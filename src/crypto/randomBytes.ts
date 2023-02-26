import nacl from 'tweetnacl';

export const randomBytes = (length: number): Uint8Array => nacl.randomBytes(length);
