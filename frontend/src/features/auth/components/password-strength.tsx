import { CheckIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PASSWORD_RULES, passwordStrength } from '../schemas';

const SCORE_CLASSES = ['bg-muted', 'bg-destructive', 'bg-warning', 'bg-success', 'bg-primary'];

/** Indikator kekuatan password + checklist aturan wajib (BUSINESS-RULES §13). */
export function PasswordStrength({ value, id }: { value: string; id?: string }) {
  const { score, label } = passwordStrength(value);
  return (
    <div id={id} className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map((step) => (
            <span
              key={step}
              className={cn(
                'h-1.5 flex-1 rounded-full bg-muted transition-colors',
                score >= step && SCORE_CLASSES[score],
              )}
            />
          ))}
        </div>
        <span
          className="shrink-0 text-right text-xs font-medium whitespace-nowrap text-muted-foreground"
          aria-live="polite"
        >
          {label ? `Kekuatan: ${label}` : ''}
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(value);
          return (
            <li
              key={rule.id}
              className={cn(
                'flex items-center gap-1.5',
                ok ? 'text-success' : 'text-muted-foreground',
              )}
            >
              {ok ? (
                <CheckIcon className="size-3.5" aria-hidden="true" />
              ) : (
                <XIcon className="size-3.5" aria-hidden="true" />
              )}
              <span>
                {rule.label}
                <span className="sr-only">{ok ? ' (terpenuhi)' : ' (belum terpenuhi)'}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
