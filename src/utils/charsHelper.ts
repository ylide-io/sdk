export const literalCharsMap: { [char: string]: boolean } = {
	'a': true,
	'b': true,
	'c': true,
	'd': true,
	'e': true,
	'f': true,
	'g': true,
	'h': true,
	'i': true,
	'j': true,
	'k': true,
	'l': true,
	'm': true,
	'n': true,
	'o': true,
	'p': true,
	'q': true,
	'r': true,
	's': true,
	't': true,
	'u': true,
	'v': true,
	'w': true,
	'x': true,
	'y': true,
	'z': true,
	'A': true,
	'B': true,
	'C': true,
	'D': true,
	'E': true,
	'F': true,
	'G': true,
	'H': true,
	'I': true,
	'J': true,
	'K': true,
	'L': true,
	'M': true,
	'N': true,
	'O': true,
	'P': true,
	'Q': true,
	'R': true,
	'S': true,
	'T': true,
	'U': true,
	'V': true,
	'W': true,
	'X': true,
	'Y': true,
	'Z': true,
	'0': true,
	'1': true,
	'2': true,
	'3': true,
	'4': true,
	'5': true,
	'6': true,
	'7': true,
	'8': true,
	'9': true,
	'_': true,
	'-': true,
};

export const isLiteralChar = (char: string): boolean => {
	return literalCharsMap[char] === true;
};

export const isSpaceChar = (char: string): boolean => {
	return char === ' ' || char === '\t' || char === '\r' || char === '\n';
};

const nbsp = String.fromCharCode(160);

export const decodeSpecialChar = (char: string): string => {
	if (char === '&nbsp;') {
		return nbsp;
	} else if (char === '&lt;') {
		return '<';
	} else if (char === '&gt;') {
		return '>';
	} else if (char === '&amp;') {
		return '&';
	} else {
		throw new Error(`Unknown special char to decode: ${char}`);
	}
};

export const encodeSpecialChar = (char: string): string => {
	if (char === nbsp) {
		return '&nbsp;';
	} else if (char === '<') {
		return '&lt;';
	} else if (char === '>') {
		return '&gt;';
	} else if (char === '&') {
		return '&amp;';
	} else {
		throw new Error(`Unknown special char to encode: ${char}`);
	}
};
