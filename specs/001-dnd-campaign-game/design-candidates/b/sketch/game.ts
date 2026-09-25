import type { Id, Nonempty, Revision } from './contracts.ts';
import type { CommandRequest, GameEvent, SaveView, TitleView } from './campaign.ts';
import type { Director } from './turn.ts';

export interface StartRequest {
	readonly operation: Id<'operation'>;
	readonly campaignFile: string;
	readonly seed: number;
}
export interface Receipt {
	readonly operation: Id<'operation'>;
	readonly revision: Revision;
	readonly status: 'applied' | 'refused' | 'stalled';
	readonly view: SaveView;
}
export type SubmitResult =
	| { readonly kind: 'settled'; readonly receipt: Receipt }
	| { readonly kind: 'pending'; readonly operation: Id<'operation'>; readonly view: SaveView }
	| { readonly kind: 'conflict'; readonly reason: 'revision' | 'operation-reused' | 'busy'; readonly view: SaveView };
export interface Game {
	start(request: StartRequest): Promise<Receipt>;
	submit(save: Id<'save'>, request: CommandRequest): Promise<SubmitResult>;
	view(save: Id<'save'>): Promise<SaveView>;
	title(): Promise<TitleView>;
	delete(save: Id<'save'>, operation: Id<'operation'>): Promise<'deleted' | 'already-deleted' | 'busy'>;
	close(): Promise<void>;
}
export interface GameOptions {
	readonly databasePath: string;
	readonly director: Director;
}
export function newOperationId(): Id<'operation'> {
	throw new Error('not implemented');
}
export function openGame(options: GameOptions): Game {
	// TODO Own the database lock, run versioned recovery, then expose only committed projections.
	// start pins admitted input; submit reserves identity, calls the director at most once,
	// settles by CAS, and reconstructs retry receipts at their original terminal revisions.
	throw new Error('not implemented');
}
export interface HttpApp {
	listen(port: number): Promise<number>;
	close(): Promise<void>;
}
export function createHttpApp(options: { readonly game: Game; readonly publicDirectory: string }): HttpApp {
	// TODO Parse bounded bodies into domain requests and map explicit results to HTTP.
	// Render imported names as text; serialize only PlayerView plus receipt identity and status.
	throw new Error('not implemented');
}
export interface StoredLog {
	readonly save: Id<'save'>;
	readonly head: Revision;
	readonly events: readonly GameEvent[];
}
export interface Journal {
	load(save: Id<'save'>): StoredLog | null;
	operation(save: Id<'save'>, operation: Id<'operation'>): readonly GameEvent[];
	append(save: Id<'save'>, expected: Revision, events: Nonempty<GameEvent>): 'committed' | 'conflict';
}
export function sqliteJournal(path: string): Journal {
	// TODO Enforce accepted and terminal operation uniqueness with partial indexes on events.
	// Compare heads and append each batch in BEGIN IMMEDIATE; rollback every failed batch.
	throw new Error('not implemented');
}
