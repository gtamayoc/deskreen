export default (s: string, isConsole = false, sourceName = ''): string => {
	return JSON.stringify({
		type: 'screen_sharing_source_type',
		payload: {
			value: s,
			isConsole,
			sourceName,
		},
	});
};
