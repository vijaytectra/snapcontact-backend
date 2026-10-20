import { R } from './runtimeStrings.ts';
export type ContactRequest = { id: string; name: string; number: string };
export type ContactOutcome = { id: string; name: string; status: 'saved' | 'cancelled' | 'error'; message?: string };

/** Only one OS editor at a time; cancelling or failing stops the queue without
 * consuming the remaining selection. Inject the editor so the semantics can be
 * tested without pretending to run native system UI. */
export async function runContactQueue(
  requests: ContactRequest[],
  openEditor: (name: string, number: string) => Promise<{ status: 'saved' | 'cancelled' }>,
  onResult: (result: ContactOutcome) => void,
) {
  for (const request of requests) {
    try {
      const result = await openEditor(request.name, request.number);
      onResult({ id: request.id, name: request.name || request.number, status: result.status });
      if (result.status !== 'saved') break;
    } catch (error) {
      onResult({
        id: request.id, name: request.name || request.number, status: 'error',
        message: error instanceof Error ? error.message : R.editorUnavailable,
      });
      break;
    }
  }
}
