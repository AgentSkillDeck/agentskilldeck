// Tests plan against a fixed native-tag table, not the calibrated one.
import { fileURLToPath } from 'node:url';

export const NATIVE_FIXTURE = fileURLToPath(new URL('./native-tags.json', import.meta.url));
process.env.AGENTATELIER_NATIVE_TAGS = NATIVE_FIXTURE;
