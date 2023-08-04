export const safeJsonParse = (json: any, defaultValue?: any) => {
	try {
		return JSON.parse(json);
	} catch (e) {
		return defaultValue;
	}
};
