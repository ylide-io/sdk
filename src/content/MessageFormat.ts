export type YMF = string & { __ylideMessageFormat: true };

export interface IYMFToken {
	start: number;
	type: 'text' | 'special';
	raw: string;
	escaped: string;
}

export class MessageFormat {
	static fromSimpleText(text: string): YMF {
		let result = '';
		for (const char of text) {
			if (char === '\\') {
				result += '\\\\';
			} else if (char === '<') {
				result += '\\<';
			} else if (char === '>') {
				result += '\\>';
			} else {
				result += char;
			}
		}
		return result as YMF;
	}

	static fromAdvancedText(text: string): YMF {
		const validationState = this.validateYMF(text);
		if (validationState.result) {
			return text as YMF;
		} else {
			throw new Error(validationState.errorText + ` at pos ${validationState.errorPos}`);
		}
	}

	static extractSimpleText(content: YMF): string {
		let inEscapeChar = false;
		let inSpecialZone = false;
		let text = '';
		for (const char of content) {
			if (inEscapeChar) {
				text += char;
				inEscapeChar = false;
			} else if (inSpecialZone) {
				if (char === '<') {
					throw new Error('Special zones can not be nested');
				} else if (char === '>') {
					inSpecialZone = false;
				} else if (char === '\\') {
					inEscapeChar = true;
				} else {
					// do nothing, we skip content in special zones when extracting simple text
				}
			} else {
				if (char === '<') {
					inSpecialZone = true;
				} else if (char === '>') {
					throw new Error('Can not close special zone when you are not in it');
				} else if (char === '\\') {
					inEscapeChar = true;
				} else {
					text += char;
				}
			}
		}
		if (inSpecialZone) {
			throw new Error('Special zone was not closed by the end of the content');
		}
		if (inEscapeChar) {
			throw new Error('Escaped char was not found by the end of the content');
		}
		return text;
	}

	static extractTokenTree(content: YMF): IYMFToken[] {
		const tokens: IYMFToken[] = [];
		let currentToken: IYMFToken | null = null;
		let inEscapeChar = false;
		let inSpecialZone = false;
		for (let i = 0; i < content.length; i++) {
			if (inEscapeChar) {
				if (!currentToken) {
					throw new Error('You can not be in escape state without active currentToken');
				} else {
					currentToken.raw += content[i];
					currentToken.escaped += content[i];
				}
				inEscapeChar = false;
			} else if (inSpecialZone) {
				if (!currentToken) {
					throw new Error('Should be impossible: can not be in special zone without active currentToken');
				}
				if (content[i] === '<') {
					throw new Error('Special zones can not be nested');
				} else if (content[i] === '>') {
					inSpecialZone = false;
					currentToken.raw += content[i];
					currentToken = null;
				} else if (content[i] === '\\') {
					currentToken.raw += content[i];
					inEscapeChar = true;
				} else {
					currentToken.raw += content[i];
					currentToken.escaped += content[i];
					// do nothing, we skip content in special zones when extracting simple text
				}
			} else {
				if (content[i] === '<') {
					inSpecialZone = true;
					currentToken = {
						start: i,
						type: 'special',
						raw: content[i],
						escaped: '',
					};
					tokens.push(currentToken);
				} else if (content[i] === '>') {
					throw new Error('Can not close special zone when you are not in it');
				} else if (content[i] === '\\') {
					inEscapeChar = true;
					if (!currentToken) {
						currentToken = {
							start: i,
							type: 'text',
							raw: content[i],
							escaped: '',
						};
						tokens.push(currentToken);
					} else {
						currentToken.raw += content[i];
					}
				} else {
					if (!currentToken) {
						currentToken = {
							start: i,
							type: 'text',
							raw: content[i],
							escaped: content[i],
						};
						tokens.push(currentToken);
					} else {
						currentToken.raw += content[i];
						currentToken.escaped += content[i];
					}
				}
			}
		}
		if (inSpecialZone) {
			throw new Error('Special zone was not closed by the end of the content');
		}
		if (inEscapeChar) {
			throw new Error('Escaped char was not found by the end of the content');
		}
		return tokens;
	}

	static validateYMF(content: string): { result: true } | { result: false; errorPos: number; errorText: string } {
		let currentTokenActive = false;
		let inEscapeChar = false;
		let inSpecialZone = false;
		for (let i = 0; i < content.length; i++) {
			if (inEscapeChar) {
				if (!currentTokenActive) {
					return {
						result: false,
						errorPos: i,
						errorText: 'You can not be in escape state without active currentToken',
					};
				}
				inEscapeChar = false;
			} else if (inSpecialZone) {
				if (!currentTokenActive) {
					return {
						result: false,
						errorPos: i,
						errorText: 'Should be impossible: can not be in special zone without active currentToken',
					};
				}
				if (content[i] === '<') {
					return { result: false, errorPos: i, errorText: 'Special zones can not be nested' };
				} else if (content[i] === '>') {
					inSpecialZone = false;
					currentTokenActive = false;
				} else if (content[i] === '\\') {
					inEscapeChar = true;
				} else {
					// do nothing, we skip content in special zones when extracting simple text
				}
			} else {
				if (content[i] === '<') {
					inSpecialZone = true;
				} else if (content[i] === '>') {
					return {
						result: false,
						errorPos: i,
						errorText: 'Can not close special zone when you are not in it',
					};
				} else if (content[i] === '\\') {
					inEscapeChar = true;
				}
				currentTokenActive = true;
			}
		}
		if (inSpecialZone) {
			return {
				result: false,
				errorPos: content.length,
				errorText: 'Special zone was not closed by the end of the content',
			};
		}
		if (inEscapeChar) {
			return {
				result: false,
				errorPos: content.length,
				errorText: 'Escaped char was not found by the end of the content',
			};
		}
		return { result: true };
	}
}
