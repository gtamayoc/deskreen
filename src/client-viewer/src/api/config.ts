const defaultHost =
	typeof window !== 'undefined' && window.location?.host
		? window.location.host.split(':')[0]
		: 'localhost';
const defaultProtocol =
	typeof window !== 'undefined' && window.location?.protocol
		? window.location.protocol.replace(':', '')
		: 'http';
const defaultPort =
	typeof window !== 'undefined' && window.location?.port
		? parseInt(window.location.port, 10) || 3131
		: 3131;

const config = {
	host: defaultHost,
	port: defaultPort,
	protocol: defaultProtocol,
	setHost(newHost: string) {
		config.host = newHost;
	},
};

export default config;
