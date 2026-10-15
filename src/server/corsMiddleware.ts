import { Context, Next } from 'koa';

export interface CorsOptions {
	origin?: string | ((ctx: Context) => string | boolean);
	allowMethods?: string[];
	allowHeaders?: string[];
	exposeHeaders?: string[];
	maxAge?: number;
	credentials?: boolean;
}

export function cors(options: CorsOptions = {}) {
	const allowMethods =
		options.allowMethods?.join(',') || 'GET,HEAD,PUT,POST,DELETE,PATCH';
	const credentials = options.credentials !== false;

	return async function corsMiddleware(ctx: Context, next: Next) {
		const requestOrigin = ctx.get('Origin');
		ctx.vary('Origin');

		if (!requestOrigin) {
			return next();
		}

		let origin = requestOrigin;
		if (typeof options.origin === 'function') {
			const res = options.origin(ctx);
			if (!res) return next();
			if (typeof res === 'string') origin = res;
		} else if (options.origin) {
			origin = options.origin;
		}

		if (ctx.method !== 'OPTIONS') {
			ctx.set('Access-Control-Allow-Origin', origin);
			if (credentials) {
				ctx.set('Access-Control-Allow-Credentials', 'true');
			}
			if (options.exposeHeaders) {
				ctx.set('Access-Control-Expose-Headers', options.exposeHeaders.join(','));
			}
			return next();
		}

		// Preflight OPTIONS handling
		if (!ctx.get('Access-Control-Request-Method')) {
			return next();
		}

		ctx.set('Access-Control-Allow-Origin', origin);
		if (credentials) {
			ctx.set('Access-Control-Allow-Credentials', 'true');
		}
		if (options.maxAge) {
			ctx.set('Access-Control-Max-Age', String(options.maxAge));
		}
		ctx.set('Access-Control-Allow-Methods', allowMethods);

		const requestHeaders = ctx.get('Access-Control-Request-Headers');
		if (requestHeaders) {
			ctx.set('Access-Control-Allow-Headers', requestHeaders);
		} else if (options.allowHeaders) {
			ctx.set('Access-Control-Allow-Headers', options.allowHeaders.join(','));
		}

		ctx.status = 204;
	};
}

export default cors;
