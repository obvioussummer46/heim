'use client';

import { useState } from 'react';
import { DEFAULT_RELAYS, useAppStore } from '@/lib/store';
import { hasNip07, npubOf, useIdentity } from '@/lib/nostr/identity';
import { displayName, useNostrStore } from '@/lib/nostr/nostrStore';
import { nostr } from '@/lib/nostr/manager';
import { Avatar } from './Avatar';

export function Settings() {
  const relays = useAppStore((s) => s.relays);
  const setRelays = useAppStore((s) => s.setRelays);
  const nickname = useAppStore((s) => s.nickname);
  const setNickname = useAppStore((s) => s.setNickname);
  const pubkey = useIdentity((s) => s.pubkey);
  const method = useIdentity((s) => s.method);
  const loginNip07 = useIdentity((s) => s.loginNip07);
  const useLocalKey = useIdentity((s) => s.useLocalKey);
  const profiles = useNostrStore((s) => s.profiles);

  const [newRelay, setNewRelay] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function addRelay() {
    const url = newRelay.trim().replace(/\/+$/, '');
    if (!/^wss?:\/\/[^\s]+$/.test(url)) return;
    if (!relays.includes(url)) setRelays([...relays, url]);
    setNewRelay('');
  }

  async function connectExtension() {
    setLoginError(null);
    const ok = await loginNip07();
    if (ok && pubkey) nostr.wantProfile(pubkey);
    if (!ok) {
      setLoginError(
        hasNip07()
          ? 'The extension refused or returned an invalid key.'
          : 'No NIP-07 extension found (e.g. Alby, nos2x).'
      );
    }
  }

  async function copyNpub() {
    if (!pubkey) return;
    try {
      await navigator.clipboard.writeText(npubOf(pubkey));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* identity */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Identity
        </h3>
        {pubkey && (
          <div className="flex items-center gap-3 rounded-xl bg-surface p-3">
            <Avatar pubkey={pubkey} picture={profiles.get(pubkey)?.picture} size={40} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {displayName(pubkey, profiles)}
                <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-400">
                  {method === 'nip07' ? 'extension' : 'local key'}
                </span>
              </div>
              <button
                onClick={copyNpub}
                className="block max-w-full truncate font-mono text-xs text-gray-500 hover:text-gray-300"
                title="Copy npub"
              >
                {copied ? 'copied!' : npubOf(pubkey)}
              </button>
            </div>
          </div>
        )}
        <div className="mt-2 flex gap-2">
          {method !== 'nip07' ? (
            <button
              onClick={connectExtension}
              className="flex-1 rounded-xl bg-accent-dim py-2 text-sm font-medium text-white"
            >
              Connect NIP-07 extension
            </button>
          ) : (
            <button
              onClick={useLocalKey}
              className="flex-1 rounded-xl border border-white/10 py-2 text-sm text-gray-300"
            >
              Switch to local key
            </button>
          )}
        </div>
        {loginError && <p className="mt-1 text-xs text-rose-400">{loginError}</p>}
        {method === 'local' && (
          <p className="mt-1 text-xs text-gray-600">
            An ephemeral key stored only in this browser — fine for lurking and chat.
          </p>
        )}
      </section>

      {/* chat nickname */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Chat nickname
        </h3>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value.slice(0, 32))}
          placeholder="Shown in geohash chat (n tag)"
          className="w-full rounded-xl border border-white/10 bg-surface px-3 py-2 text-sm outline-none focus:border-accent/60"
        />
      </section>

      {/* relays */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Relays
        </h3>
        <ul className="flex flex-col gap-1">
          {relays.map((r) => (
            <li
              key={r}
              className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2"
            >
              <span className="truncate font-mono text-xs text-gray-300">{r}</span>
              <button
                onClick={() => setRelays(relays.filter((x) => x !== r))}
                className="text-gray-600 hover:text-rose-400"
                aria-label={`Remove ${r}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <input
            value={newRelay}
            onChange={(e) => setNewRelay(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRelay()}
            placeholder="wss://relay.example.com"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-accent/60"
          />
          <button
            onClick={addRelay}
            className="rounded-xl border border-white/10 px-4 text-sm text-gray-300"
          >
            Add
          </button>
        </div>
        <button
          onClick={() => setRelays(DEFAULT_RELAYS)}
          className="mt-2 text-xs text-accent underline"
        >
          Reset to defaults
        </button>
        <p className="mt-1 text-xs text-gray-600">
          Relays that don&apos;t index the g tag still work — events are filtered client-side.
        </p>
      </section>
    </div>
  );
}
