import { YlideMisusageError } from '../errors/YlideMisusageError';
import { decodeSpecialChar, encodeSpecialChar, isLiteralChar, isSpaceChar } from '../utils/charsHelper';

export interface IYMFTextToken {
	type: 'text';
	text: string;
}

export interface IYMFSymbolToken {
	type: 'symbol';
	text: string;
	raw: string;
}

export interface IYMFTagToken {
	type: 'tag';
	tag: string;
	attributes: Record<string, string>;
	tagType: 'open' | 'close' | 'self-closing';
}

export type IYMFToken = IYMFTextToken | IYMFSymbolToken | IYMFTagToken;

export interface IYMFRootNode {
	parent: null;
	type: 'root';
	children: IYMFNode[];
}

export interface IYMFTextNode {
	parent: IYMFNode | null;
	type: 'text';
	text: string;
}

export interface IYMFSymbolNode {
	parent: IYMFNode | null;
	type: 'symbol';
	text: string;
}

export interface IYMFTagNode {
	parent: IYMFNode | null;
	type: 'tag';
	tag: string;
	attributes: Record<string, string>;
	singular: boolean;
	children: IYMFNode[];
}

export type IYMFNode = IYMFRootNode | IYMFTextNode | IYMFSymbolNode | IYMFTagNode;

export class YMF {
	readonly root: IYMFRootNode;

	private static tokenize(content: string): IYMFToken[] {
		const nodes: IYMFToken[] = [];
		let currentNode: IYMFToken | null = null;
		let i = 0;
		let isInsideText = true;
		let isInsideSymbol = false;
		let isInsideTagName = false;
		let isInsideAttributeName = false;
		let isInsideAttributeValue = false;
		let isInsideAttributeValueOpening = false;
		let isEscaped = false;
		let currentLiteral = '';
		let currentAttribute = '';
		while (i < content.length) {
			const c = content[i++];
			if (isInsideText) {
				if (isInsideSymbol) {
					if (c === ';') {
						isInsideSymbol = false;
						(currentNode as IYMFSymbolToken).raw += c;
						(currentNode as IYMFSymbolToken).text = decodeSpecialChar((currentNode as IYMFSymbolToken).raw);
						currentNode = null;
					} else {
						// here we may throw an error if bad symbol occurs
						(currentNode as IYMFSymbolToken).raw += c;
					}
				} else if (c === '&') {
					isInsideSymbol = true;
					currentNode = {
						type: 'symbol',
						text: '',
						raw: c,
					};
					nodes.push(currentNode);
				} else if (c === '<') {
					isInsideText = false;
					currentNode = {
						type: 'tag',
						tag: '',
						attributes: {},
						tagType: 'open',
					};
					nodes.push(currentNode);
					isInsideTagName = true;
				} else {
					if (currentNode) {
						(currentNode as IYMFTextToken).text += c;
					} else {
						currentNode = {
							type: 'text',
							text: c,
						};
						nodes.push(currentNode);
					}
				}
			} else {
				if (isInsideAttributeValueOpening) {
					if (c === '"') {
						isInsideAttributeValueOpening = false;
						isInsideAttributeValue = true;
					} else {
						throw new YlideMisusageError('YMF', 'Attribute value must be enclosed in double quotes');
					}
				} else if (isInsideAttributeValue) {
					if (isEscaped) {
						if (c === 'n') {
							currentLiteral += '\n';
						} else if (c === 'r') {
							currentLiteral += '\r';
						} else if (c === 't') {
							currentLiteral += '\t';
						} else {
							currentLiteral += c;
						}
						isEscaped = false;
					} else if (c === '\\') {
						isEscaped = true;
					} else if (c === '"') {
						isInsideAttributeValue = false;
						(currentNode as IYMFTagToken).attributes[currentAttribute] = currentLiteral;
						currentLiteral = '';
						currentAttribute = '';
					} else {
						currentLiteral += c;
					}
				} else if (isInsideAttributeName) {
					if (c === '=') {
						if (currentLiteral === '') {
							throw new YlideMisusageError('YMF', 'Attribute name can not be empty');
						}
						currentAttribute = currentLiteral;
						currentLiteral = '';
						isInsideAttributeName = false;
						isInsideAttributeValueOpening = true;
					} else if (isLiteralChar(c)) {
						currentLiteral += c;
					} else {
						throw new YlideMisusageError('YMF', `Unexpected char "${c}" in attribute name`);
					}
				} else if (isInsideTagName) {
					if (c === '>') {
						if (currentLiteral === '') {
							throw new YlideMisusageError('YMF', 'Tag name can not be empty');
						}
						(currentNode as IYMFTagToken).tag = currentLiteral;
						currentLiteral = '';
						isInsideTagName = false;
						isInsideText = true;
						currentNode = null;
					} else if (c === '/') {
						if (currentLiteral === '') {
							if ((currentNode as IYMFTagToken).tagType === 'open') {
								(currentNode as IYMFTagToken).tagType = 'close';
							} else {
								throw new YlideMisusageError('YMF', 'Syntax error: unexpected "/"');
							}
						} else {
							throw new YlideMisusageError('YMF', 'Syntax error: unexpected "/"');
						}
					} else if (isSpaceChar(c)) {
						if (currentLiteral === '') {
							throw new YlideMisusageError('YMF', 'Tag name can not be empty');
						}
						(currentNode as IYMFTagToken).tag = currentLiteral;
						currentLiteral = '';
						isInsideTagName = false;
					} else if (isLiteralChar(c)) {
						currentLiteral += c;
					} else {
						throw new YlideMisusageError('YMF', 'Syntax error: unexpected character in tag name');
					}
				} else if (isSpaceChar(c)) {
					if ((currentNode as IYMFTagToken).tagType === 'self-closing') {
						throw new YlideMisusageError('YMF', 'Syntax error: unexpected space');
					}
					// do nothing
				} else if (isLiteralChar(c)) {
					if (
						(currentNode as IYMFTagToken).tagType === 'self-closing' ||
						(currentNode as IYMFTagToken).tagType === 'close'
					) {
						throw new YlideMisusageError('YMF', 'Syntax error: unexpected char');
					}
					currentLiteral = c;
					isInsideAttributeName = true;
				} else if (c === '>') {
					isInsideText = true;
					currentNode = null;
				} else if (c === '/') {
					if ((currentNode as IYMFTagToken).tagType === 'open') {
						(currentNode as IYMFTagToken).tagType = 'self-closing';
					} else {
						throw new YlideMisusageError('YMF', 'Syntax error: unexpected character');
					}
				}
			}
		}
		if (!isInsideText) {
			throw new YlideMisusageError('YMF', `Unexpected end of input`);
		} else {
			if (isInsideSymbol) {
				throw new YlideMisusageError('YMF', `Unexpected end of input`);
			}
		}
		return nodes;
	}

	private static tokensToTree(tokens: IYMFToken[]): IYMFRootNode {
		const root: IYMFRootNode = {
			parent: null,
			type: 'root',
			children: [],
		};
		let current: IYMFNode = root;
		for (const token of tokens) {
			if (token.type === 'text') {
				if (current.type !== 'root' && current.type !== 'tag') {
					throw new YlideMisusageError('YMF', 'Syntax error: unexpected text, should be impossible');
				}
				current.children.push({
					parent: current,
					type: 'text',
					text: token.text,
				});
			} else if (token.type === 'symbol') {
				if (current.type !== 'root' && current.type !== 'tag') {
					throw new YlideMisusageError('YMF', 'Syntax error: unexpected text, should be impossible');
				}
				current.children.push({
					parent: current,
					type: 'symbol',
					text: token.text,
				});
			} else if (token.type === 'tag') {
				if (token.tagType === 'open') {
					const node: IYMFTagNode = {
						parent: current,
						type: 'tag',
						tag: token.tag,
						singular: false,
						attributes: token.attributes,
						children: [],
					};
					current.children.push(node);
					current = node;
				} else if (token.tagType === 'close') {
					if (!current.parent) {
						throw new YlideMisusageError('YMF', 'Syntax error: unexpected close tag');
					} else {
						if (current.tag !== token.tag) {
							throw new YlideMisusageError(
								'YMF',
								`Syntax error: expected close tag for "${current.tag}"`,
							);
						}
						current = current.parent;
					}
				} else if (token.tagType === 'self-closing') {
					current.children.push({
						parent: current,
						type: 'tag',
						tag: token.tag,
						attributes: token.attributes,
						singular: true,
						children: [],
					});
				}
			}
		}
		return root;
	}

	private static nodeToString(node: IYMFNode, isSimple: boolean): string {
		let text = '';
		if (node.type === 'text') {
			text += node.text;
		} else if (node.type === 'symbol') {
			if (isSimple) {
				text += node.text;
			} else {
				text += encodeSpecialChar(node.text);
			}
		} else if (node.type === 'tag') {
			if (!isSimple) {
				text += `<${node.tag}`;
				for (const attrName of Object.keys(node.attributes)) {
					// must escape double quotes, tabs, backslashes and newlines:
					const attrValue = node.attributes[attrName]
						.replace(/"/g, '\\"')
						.replace(/\t/g, '\\t')
						.replace(/\\/g, '\\\\')
						.replace(/\n/g, '\\n');
					text += ` ${attrName}="${attrValue}"`;
				}
			}
			if (node.singular) {
				if (node.children.length) {
					throw new YlideMisusageError('YMF', 'Singular tags can not have children, should be impossible');
				}
				if (!isSimple) {
					text += ' />';
				}
			} else {
				if (!isSimple) {
					text += '>';
				}
				for (const child of node.children) {
					text += this.nodeToString(child, isSimple);
				}
				if (!isSimple) {
					text += `</${node.tag}>`;
				}
			}
		} else {
			throw new YlideMisusageError('YMF', 'Unknown node type: ' + node.type);
		}
		return text;
	}

	static nodeToPlainText(node: IYMFNode): string {
		return this.nodeToString(node, true);
	}

	static nodeToYMFText(node: IYMFNode): string {
		return this.nodeToString(node, false);
	}

	private static treeToString(tree: IYMFRootNode, isSimple: boolean): string {
		let text = '';
		for (const child of tree.children) {
			text += this.nodeToString(child, isSimple);
		}
		return text;
	}

	private constructor(root: IYMFRootNode) {
		this.root = root;
	}

	static fromPlainText(text: string): YMF {
		let result = '';
		for (const char of text) {
			if (char === '<') {
				result += '&lt;';
			} else if (char === '>') {
				result += '&gt;';
			} else if (char === '&') {
				result += '&amp;';
			} else {
				result += char;
			}
		}
		return this.fromYMFText(result);
	}

	static fromYMFText(text: string): YMF {
		const tokens = this.tokenize(text);
		const tree = this.tokensToTree(tokens);
		return new YMF(tree);
	}

	toString(): string {
		return YMF.treeToString(this.root, false);
	}

	toPlainText(): string {
		return YMF.treeToString(this.root, true);
	}
}
