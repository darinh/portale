import type { CampaignBook, Digest, Issue, Nonempty } from './contracts.ts';

export interface ForgeRequest {
	readonly pitch: string;
	readonly seed: number;
	readonly modules: number;
	readonly levels: readonly [number, number];
	readonly theme: string;
}
export interface CampaignDraft {
	readonly book: CampaignBook;
	readonly diagnostics: readonly Issue[];
	readonly editorial: readonly { readonly path: string; readonly status: 'unreviewed' | 'accepted' | 'rejected'; readonly note: string }[];
	readonly textSources: readonly { readonly path: string; readonly source: 'authored' | 'model' | 'fallback'; readonly text: string }[];
}
export type Publication =
	| { readonly kind: 'published'; readonly path: string; readonly digest: Digest; readonly issues: readonly Issue[] }
	| { readonly kind: 'rejected'; readonly issues: Nonempty<Issue> };
export interface Forge {
	generate(request: ForgeRequest): Promise<CampaignDraft>;
	validate(path: string): Promise<readonly Issue[]>;
	publish(draft: CampaignDraft, path: string): Promise<Publication>;
}
export const forge: Forge = {
	async generate(request) {
		// TODO Build graph, clue and recovery slots, and encounter budgets deterministically.
		// Fill only local prose; retain failures and explicit fallback provenance.
		throw new Error('not implemented');
	},
	async validate(path) {
		throw new Error('not implemented');
	},
	async publish(draft, path) {
		// TODO Reuse admit with actual engine Support, then export atomically.
		throw new Error('not implemented');
	},
};
