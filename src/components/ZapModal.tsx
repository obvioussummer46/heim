'use client';

import { useState } from 'react';
import QRCode from 'qrcode';
import { requestZapInvoice, payWithWebln } from '@/lib/nostr/zaps';
import { displayName, useNostrStore, type Note } from '@/lib/nostr/nostrStore';

const PRESETS = [21, 100, 500, 1000, 5000];

type Stage = 'pick' | 'fetching' | 'invoice' | 'paid';

/** NIP-57 zap sender: amount picker → invoice → WebLN or QR fallback. */
export function ZapModal({ note, onClose }: { note: Note; onClose: () => void }) {
  const profiles = useNostrStore((s) => s.profiles);
  const [amount, setAmount] = useState(100);
  const [comment, setComment] = useState('');
  const [stage, setStage] = useState<Stage>('pick');
  const [invoice, setInvoice] = useState('');
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = displayName(note.pubkey, profiles);

  async function zap() {
    setStage('fetching');
    setError(null);
    try {
      const { pr } = await requestZapInvoice(note, amount, comment.trim());
      // WebLN first — if the wallet pays, we're done.
      if (await payWithWebln(pr)) {
        setStage('paid');
        return;
      }
      setInvoice(pr);
      setQr(await QRCode.toDataURL(pr.toUpperCase(), { margin: 1, width: 280 }));
      setStage('invoice');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Zap failed');
      setStage('pick');
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(invoice);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — user can long-press the QR instead
    }
  }

  if (stage === 'paid') {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <span className="text-4xl">⚡</span>
        <p className="font-medium">Zapped {amount} sats to {name}!</p>
        <button onClick={onClose} className="rounded-xl bg-accent-dim px-6 py-2 text-sm font-medium text-white">
          Done
        </button>
      </div>
    );
  }

  if (stage === 'invoice') {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-gray-400">
          Pay {amount} sats with any lightning wallet to zap {name}:
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr && <img src={qr} alt="Lightning invoice QR" className="rounded-xl bg-white p-2" />}
        <div className="w-full break-all rounded-lg bg-surface px-3 py-2 font-mono text-[10px] text-gray-500">
          {invoice}
        </div>
        <div className="flex w-full gap-2">
          <button onClick={copy} className="flex-1 rounded-xl border border-white/10 py-2 text-sm">
            {copied ? 'Copied!' : 'Copy invoice'}
          </button>
          <a
            href={`lightning:${invoice}`}
            className="flex-1 rounded-xl bg-accent-dim py-2 text-center text-sm font-medium text-white"
          >
            Open wallet
          </a>
        </div>
        <p className="text-xs text-gray-600">
          The zap receipt will appear on the note once the recipient&apos;s lightning service
          publishes it.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-400">
        Zap <span className="font-medium text-gray-200">{name}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((v) => (
          <button
            key={v}
            onClick={() => setAmount(v)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              amount === v ? 'bg-amber-500/20 text-amber-300' : 'bg-white/5 text-gray-400'
            }`}
          >
            ⚡{v}
          </button>
        ))}
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
          className="w-24 rounded-full border border-white/10 bg-surface px-3 py-1.5 text-sm outline-none focus:border-amber-400/60"
          aria-label="Custom amount in sats"
        />
      </div>
      <input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Add a comment (optional)"
        className="w-full rounded-xl border border-white/10 bg-surface px-3 py-2 text-sm outline-none focus:border-accent/60"
      />
      {error && <div className="text-xs text-rose-400">{error}</div>}
      <button
        onClick={zap}
        disabled={stage === 'fetching'}
        className="rounded-xl bg-amber-500/90 py-2.5 font-semibold text-black disabled:opacity-50"
      >
        {stage === 'fetching' ? 'Getting invoice…' : `Zap ${amount} sats`}
      </button>
    </div>
  );
}
