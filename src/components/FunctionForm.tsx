import { useState } from 'react';
import { Contract, formatEther, parseEther, isAddress } from 'ethers';
import { useTranslation } from 'react-i18next';
import { PlayIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useTxToast } from '../hooks/useTxToast';

export interface AbiInput {
  name: string;
  type: string;
  components?: AbiInput[];
  internalType?: string;
}

export interface AbiFragment {
  name: string;
  type: 'function';
  stateMutability: 'pure' | 'view' | 'nonpayable' | 'payable';
  inputs: AbiInput[];
  outputs?: AbiInput[];
}

export function isReadFn(f: AbiFragment) {
  return f.stateMutability === 'view' || f.stateMutability === 'pure';
}

function parseInputValue(type: string, raw: string): any {
  const trimmed = raw.trim();
  if (type.endsWith('[]')) {
    const base = type.slice(0, -2);
    if (!trimmed) return [];
    let arr: any[];
    try { arr = JSON.parse(trimmed); }
    catch { arr = trimmed.split(',').map((s) => s.trim()).filter(Boolean); }
    return arr.map((v) => parseInputValue(base, String(v)));
  }
  if (type === 'address') {
    if (!isAddress(trimmed)) throw new Error(`Invalid address: ${trimmed}`);
    return trimmed;
  }
  if (type === 'bool') {
    if (trimmed === 'true' || trimmed === '1') return true;
    if (trimmed === 'false' || trimmed === '0' || trimmed === '') return false;
    throw new Error(`Invalid bool: ${trimmed}`);
  }
  if (type.startsWith('uint') || type.startsWith('int')) {
    if (trimmed === '') return 0n;
    return BigInt(trimmed);
  }
  if (type.startsWith('bytes') && type !== 'bytes') {
    return trimmed;
  }
  return trimmed;
}

function formatOutput(value: any): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return JSON.stringify(value, (_k, v) => typeof v === 'bigint' ? v.toString() : v, 2);
  if (typeof value === 'object') return JSON.stringify(value, (_k, v) => typeof v === 'bigint' ? v.toString() : v, 2);
  return String(value);
}

export default function FunctionForm({
  contract, fragment, onDone,
}: {
  contract: Contract;
  fragment: AbiFragment;
  onDone?: () => void;
}) {
  const { t } = useTranslation();
  const { execute } = useTxToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [payableValue, setPayableValue] = useState('0');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const readOnly = isReadFn(fragment);

  const setVal = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));

  const run = async () => {
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const args = fragment.inputs.map((inp, i) =>
        parseInputValue(inp.type, values[inp.name || `arg${i}`] ?? '')
      );
      if (readOnly) {
        const out = await (contract as any)[fragment.name](...args);
        setResult(formatOutput(out));
      } else {
        const opts: any = {};
        if (fragment.stateMutability === 'payable') {
          opts.value = parseEther(payableValue || '0');
        }
        const receipt = await execute(
          () => (contract as any)[fragment.name](...args, opts),
          {
            pending: t('admin.tx.pending', 'Submitting {{name}}…', { name: fragment.name }),
            success: t('admin.tx.success', '{{name}} confirmed', { name: fragment.name }),
            errorPrefix: t('tx.error.prefix', 'Transaction failed'),
          }
        );
        if (receipt) {
          setResult(t('admin.tx.hash', 'Tx confirmed: {{hash}}', { hash: receipt.hash }));
          onDone?.();
        }
      }
    } catch (e: any) {
      setError(e?.reason || e?.shortMessage || e?.message || String(e));
    } finally { setBusy(false); }
  };

  return (
    <div className="card mb-3">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="min-w-0">
          <div className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            {fragment.name}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {fragment.stateMutability}
            {fragment.outputs && fragment.outputs.length > 0 && ` → ${fragment.outputs.map((o) => o.type).join(', ')}`}
          </div>
        </div>
        <button type="button" className="btn-flat primary" onClick={run} disabled={busy}>
          {busy ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <PlayIcon className="w-4 h-4" />}
          {readOnly ? t('admin.form.read', 'Read') : t('admin.form.write', 'Write')}
        </button>
      </div>

      {fragment.inputs.length > 0 && (
        <div className="grid grid-cols-1 gap-2 mb-2">
          {fragment.inputs.map((inp, i) => {
            const key = inp.name || `arg${i}`;
            return (
              <label key={key} className="block">
                <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                  {key} <span className="font-mono">({inp.type})</span>
                </span>
                <input
                  className="form-input w-full mt-1"
                  type="text"
                  value={values[key] ?? ''}
                  onChange={(e) => setVal(key, e.target.value)}
                  placeholder={inp.type === 'address' ? '0x…' : inp.type.endsWith('[]') ? '[val1,val2] or comma-separated' : inp.type}
                />
              </label>
            );
          })}
        </div>
      )}

      {fragment.stateMutability === 'payable' && (
        <label className="block mb-2">
          <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
            {t('admin.form.value', 'Value (ETH)')}
          </span>
          <input
            className="form-input w-full mt-1"
            type="number"
            step="0.001"
            min="0"
            value={payableValue}
            onChange={(e) => setPayableValue(e.target.value)}
          />
        </label>
      )}

      {error && (
        <div className="text-xs rounded-lg p-2 mt-2" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
          {error}
        </div>
      )}
      {result !== null && (
        <div className="text-xs rounded-lg p-2 mt-2" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
          <div className="uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>
            {t('admin.form.result', 'Result')}
          </div>
          <pre className="whitespace-pre-wrap break-all font-mono">{result}</pre>
        </div>
      )}
    </div>
  );
}

export { formatEther };
