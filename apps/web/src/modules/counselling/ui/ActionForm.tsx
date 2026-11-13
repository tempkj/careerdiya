'use client';
import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useRef,
  type FormEvent,
  type ReactNode,
} from 'react';
import { ui } from './styles';

// `at` changes on every server response, so a form can tell one success from the next.
export type FormState = { status: 'idle' | 'ok' | 'error'; message?: string; at?: number };
export type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

export const idleState: FormState = { status: 'idle' };

const PendingContext = createContext(false);

export function SubmitButton({
  children,
  pendingLabel = 'Saving…',
  variant = 'primary',
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  name?: string;
  value?: string;
}) {
  const pending = useContext(PendingContext);
  const cls = variant === 'primary' ? ui.btn : variant === 'danger' ? ui.btnDanger : ui.btnSecondary;
  return (
    <button type="submit" className={cls} disabled={pending} name={name} value={value}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.status === 'idle' || !state.message) return null;
  return (
    <p
      role={state.status === 'error' ? 'alert' : 'status'}
      className={`text-sm ${state.status === 'error' ? 'text-red-700' : 'text-emerald-700'}`}
    >
      {state.message}
    </p>
  );
}

/**
 * A form bound to a server action, showing its success or error message.
 * Submits through onSubmit (not the `action` prop) so React does not clear the fields when
 * the server returns an error; fields are reset only after a success, if asked.
 */
export default function ActionForm({
  action,
  children,
  className = 'space-y-4',
  resetOnSuccess = false,
  confirm,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
}) {
  const [state, dispatch, pending] = useActionState(action, idleState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.status === 'ok') formRef.current?.reset();
  }, [state, resetOnSuccess]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirm && !window.confirm(confirm)) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const data = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(data));
  }

  return (
    <PendingContext.Provider value={pending}>
      <form ref={formRef} onSubmit={onSubmit} className={className} aria-busy={pending}>
        {children}
        <FormMessage state={state} />
      </form>
    </PendingContext.Provider>
  );
}
