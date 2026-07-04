'use client';

import { useState } from 'react';

/** Deterministic hue from a pubkey so anonymous users are tellable-apart. */
export function pubkeyHue(pubkey: string): number {
  let h = 0;
  for (let i = 0; i < Math.min(pubkey.length, 16); i++) {
    h = (h * 31 + pubkey.charCodeAt(i)) % 360;
  }
  return h;
}

export function Avatar({
  pubkey,
  picture,
  size = 36,
}: {
  pubkey: string;
  picture?: string;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  const hue = pubkeyHue(pubkey);
  if (picture && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={picture}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold"
      style={{
        width: size,
        height: size,
        background: `hsl(${hue} 45% 24%)`,
        color: `hsl(${hue} 70% 75%)`,
      }}
    >
      {pubkey.slice(0, 2)}
    </div>
  );
}
