import type { CSSProperties } from "react";
import { BenchPack, type BenchPackRow } from "@/components/BenchPack";
import { seriesColor } from "@/lib/color";
import { assignPorts, type AssignedPort, type NextChargeAlone, type NextChargeBoard } from "@/lib/next-charge.mjs";

function BoardTop() {
  return (
    <svg viewBox="0 0 320 68" className="six-banner" role="img" aria-label="Input pair, meter, and discharge block">
      <rect x="1" y="1" width="318" height="66" rx="8" fill="#0c1218" stroke="rgba(168,196,220,0.28)" />
      <rect x="12" y="18" width="34" height="28" rx="4" fill="none" stroke="#f5b942" strokeWidth="1.6" />
      <rect x="20" y="24" width="5" height="16" rx="1" fill="#f5b942" />
      <rect x="31" y="24" width="5" height="16" rx="1" fill="#f5b942" />
      <rect x="52" y="24" width="20" height="16" rx="3" fill="none" stroke="#f5b942" strokeWidth="1.3" />
      <rect x="57" y="28" width="3.5" height="8" fill="#f5b942" />
      <rect x="64" y="28" width="3.5" height="8" fill="#f5b942" />
      <rect x="108" y="16" width="84" height="34" rx="4" fill="#080c11" stroke="#3ddc97" strokeWidth="1.3" />
      <rect x="116" y="24" width="18" height="18" rx="1" fill="#10241c" stroke="#3ddc97" strokeWidth="0.8" />
      <rect x="140" y="24" width="18" height="18" rx="1" fill="#10241c" stroke="#3ddc97" strokeWidth="0.8" />
      <rect x="164" y="24" width="18" height="18" rx="1" fill="#10241c" stroke="#3ddc97" strokeWidth="0.8" />
      <rect x="214" y="14" width="92" height="40" rx="6" fill="#141820" stroke="rgba(168,196,220,0.35)" />
      <rect x="226" y="28" width="30" height="12" rx="6" fill="#0c1218" stroke="#9aafc0" strokeWidth="1.2" />
      <circle cx="236" cy="34" r="4" fill="#9aafc0" />
      <path d="M268 26 v16 M276 22 v24 M284 28 v12" stroke="#ff5c7a" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BoardLeads() {
  return (
    <svg viewBox="0 0 320 46" className="six-banner" aria-hidden="true">
      <path d="M78 2 v16 H146" stroke="#d5dde4" strokeWidth="3" strokeLinecap="round" fill="none" />
      <rect x="146" y="8" width="22" height="16" rx="2" fill="#d5dde4" />
      <path d="M158 24 v8" stroke="#d5dde4" strokeWidth="2" strokeLinecap="round" />
      <path d="M246 2 v20" stroke="#f5b942" strokeWidth="4" strokeLinecap="round" />
      <rect x="232" y="22" width="28" height="16" rx="3" fill="none" stroke="#f5b942" strokeWidth="1.6" />
      <rect x="238" y="26" width="5" height="8" fill="#f5b942" />
      <rect x="249" y="26" width="5" height="8" fill="#f5b942" />
    </svg>
  );
}

function BalanceHeader() {
  return (
    <svg viewBox="0 0 16 54" className="six-balance" aria-hidden="true">
      <rect x="1" y="1" width="14" height="52" rx="2" fill="#0c1218" stroke="#6d8294" strokeWidth="1" />
      {Array.from({ length: 7 }, (_, index) => (
        <rect key={index} x="4" y={6 + index * 6.4} width="8" height="2.2" rx="0.4" fill="#9aafc0" />
      ))}
    </svg>
  );
}

function Fuse() {
  return (
    <svg viewBox="0 0 12 22" className="six-fuse" aria-hidden="true">
      <rect x="0.8" y="0.8" width="10.4" height="20.4" rx="1.6" fill="#16324a" stroke="#79b8ff" strokeWidth="1" />
      <rect x="3.2" y="4" width="5.6" height="14" rx="0.8" fill="#79b8ff" opacity="0.9" />
    </svg>
  );
}

function PortPlugs({ color, filled }: { color: string; filled: boolean }) {
  const stroke = filled ? color : "rgba(154,175,192,0.45)";
  return (
    <svg viewBox="0 0 34 42" className="six-plugs" aria-hidden="true">
      <rect x="1.5" y="1.5" width="31" height="22" rx="4" fill="#0c141c" stroke={stroke} strokeWidth="1.5" />
      <rect x="9" y="6" width="5" height="13" rx="1" fill={stroke} />
      <rect x="20" y="6" width="5" height="13" rx="1" fill={stroke} />
      <rect x="7" y="28" width="20" height="12" rx="2.5" fill="#0c141c" stroke={stroke} strokeWidth="1.2" />
      <rect x="11" y="31" width="3.5" height="6" fill={stroke} />
      <rect x="19.5" y="31" width="3.5" height="6" fill={stroke} />
    </svg>
  );
}

function PortSlot({
  slot,
  color,
  resolve,
}: {
  slot: AssignedPort;
  color: string;
  resolve: (label: string) => BenchPackRow;
}) {
  return (
    <div className="six-slot">
      <div className="six-plug">
        <span className="six-id">{slot.id}</span>
        <PortPlugs color={color} filled={Boolean(slot.pack)} />
      </div>
      {slot.pack ? <BenchPack pack={resolve(slot.pack)} note={slot.note} /> : null}
    </div>
  );
}

export function ParallelBoardDiagram({
  board,
  resolve,
}: {
  board: NextChargeBoard;
  resolve: (label: string) => BenchPackRow;
}) {
  const color = seriesColor(board.series);
  const slots = assignPorts(board.ports, board.series);
  const rows = [0, 1, 2].map((index) => ({
    left: slots[index],
    right: slots[index + 3],
  }));
  const title = board.name ? `${board.name} · ${board.series}` : board.series;

  return (
    <article className="panel" style={{ "--accent": color } as CSSProperties}>
      <header className="bench-charger-head">
        <div className="min-w-0">
          <p className="eyebrow">6-port parallel</p>
          <h3 className="panel-title">{title}</h3>
        </div>
      </header>
      <div className="six-board">
        <BoardTop />
        <div className="six-rows">
          {rows.map((row) => (
            <div key={row.left.id} className="six-row">
              <BalanceHeader />
              <PortSlot slot={row.left} color={color} resolve={resolve} />
              <div className="six-fuses" aria-hidden="true">
                <Fuse />
                <Fuse />
              </div>
              <PortSlot slot={row.right} color={color} resolve={resolve} />
              <BalanceHeader />
            </div>
          ))}
        </div>
        <BoardLeads />
      </div>
      {board.notes.length ? (
        <ul className="bench-notes">
          {board.notes.map((note, index) => (
            <li key={`${index}-${note}`} className="note">
              {note}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function ChargeAlone({
  items,
  resolve,
}: {
  items: NextChargeAlone[];
  resolve: (label: string) => BenchPackRow;
}) {
  if (items.length === 0) return null;
  return (
    <article className="panel" data-accent="rulea">
      <h3 className="panel-title">Charge alone</h3>
      <ul className="bench-ports mt-3">
        {items.map((item) => (
          <li key={item.pack} className="bench-alone-row">
            <PortPlugs color="#f5b942" filled />
            <div className="min-w-0">
              <BenchPack pack={resolve(item.pack)} />
              <p className="note mt-1">{item.reason}</p>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
