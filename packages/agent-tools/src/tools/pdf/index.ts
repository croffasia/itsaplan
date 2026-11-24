import type { Integration } from '../../types';
import { pdfRead } from './read';

// PDF reading runs in the api process, so there is no credential to configure.
export const pdf: Integration = {
  key: 'pdf',
  label: 'PDF',
  description: 'Reads the text of a PDF file.',
  credentialSchema: [],
  tools: [pdfRead],
};
