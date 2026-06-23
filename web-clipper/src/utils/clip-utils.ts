import Defuddle from 'defuddle/full';

// Parse document content for clipping.
export function parseForClip(doc: Document) {
	return new Defuddle(doc, { url: doc.URL }).parse();
}
