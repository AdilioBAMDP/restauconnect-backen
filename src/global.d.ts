// Étend le type Express Request pour inclure la propriété user (AuthRequest)
import { User } from './types';
declare global {
	namespace Express {
		interface Request {
			user?: User & { _id?: string; role?: string };
		}
	}
}
// Correction pollution typescript : restaurer les valeurs natives
declare var Date: typeof globalThis.Date;
declare var Math: typeof globalThis.Math;
declare var Number: typeof globalThis.Number;
declare var Error: typeof globalThis.Error;
declare var String: typeof globalThis.String;
