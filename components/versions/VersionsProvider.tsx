"use client";

import { createContext, useContext, useState } from "react";

/**
 * The page-wide choice of date: null shows every article as it stands now;
 * a date shows the whole act as it stood that day. The bar also hides the
 * articles that never changed, for reading the amendments alone.
 */
type VersionsState = {
  asOf: string | null;
  setAsOf: (date: string | null) => void;
  onlyChanged: boolean;
  setOnlyChanged: (on: boolean) => void;
};

const Ctx = createContext<VersionsState>({ asOf: null, setAsOf: () => {}, onlyChanged: false, setOnlyChanged: () => {} });

export function useVersions() {
  return useContext(Ctx);
}

export function VersionsProvider({ children }: { children: React.ReactNode }) {
  const [asOf, setAsOf] = useState<string | null>(null);
  const [onlyChanged, setOnlyChanged] = useState(false);
  return (
    <Ctx.Provider value={{ asOf, setAsOf, onlyChanged, setOnlyChanged }}>
      <div data-only-changed={onlyChanged}>{children}</div>
    </Ctx.Provider>
  );
}

export type Stop = { date: string; label: string };

/** "Mətn: 1995 · 2002 · 2009 · 2016 (qüvvədə)" and the filter. */
export function DateBar({ stops }: { stops: Stop[] }) {
  const { asOf, setAsOf, onlyChanged, setOnlyChanged } = useVersions();
  const last = stops[stops.length - 1];
  return (
    <div className="olg-law-bar olg-glass-deep" lang="az">
      <span className="text-silver">Mətn</span>
      <div className="olg-law-seg" role="group" aria-label="Mətnin tarixi">
        {stops.map((s) => {
          const current = s === last;
          const pressed = current ? asOf === null : asOf === s.date;
          return (
            <button key={s.date} type="button" aria-pressed={pressed} onClick={() => setAsOf(current ? null : s.date)} title={`${s.label} tarixinə`}>
              {s.label}
              {current ? " · qüvvədə" : ""}
            </button>
          );
        })}
      </div>
      <label className="inline-flex items-center gap-2 text-silver cursor-pointer">
        <input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} className="accent-[rgb(var(--olg-azure))]" />
        Yalnız dəyişən maddələr
      </label>
    </div>
  );
}
