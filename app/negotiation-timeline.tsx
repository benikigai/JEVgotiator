"use client";

import type { OptimizationSimulation } from "@/lib/contracts";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
const steps = ["Asking", "Opening offer", "Assumed counter", "Assumed agreement"];

export default function NegotiationTimeline({ candidates, title }: { candidates: OptimizationSimulation["candidates"]; title: (id: string) => string }) {
  return <div className="negotiation">
    {candidates.map(candidate => {
      const prices = [candidate.asking_price, candidate.opening_offer, candidate.simulated_counter, candidate.simulated_agreed_price];
      const max = Math.max(...prices);
      const min = Math.min(...prices);
      const span = Math.max(max - min, 1);
      const x = (i: number) => 60 + i * 160;
      const y = (price: number) => 44 + ((max - price) / span) * 50;
      return <div className="negotiation-row" key={candidate.listing_id}>
        <div className="negotiation-head"><strong>{title(candidate.listing_id)}</strong><span>{money(candidate.simulated_savings)} below asking in this scenario</span></div>
        <svg viewBox="0 0 600 150" className="negotiation-chart" role="img" aria-label={`Price path from ${money(candidate.asking_price)} asking to ${money(candidate.simulated_agreed_price)} assumed agreement`}>
          <polyline points={prices.map((p, i) => `${x(i)},${y(p)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/>
          {prices.map((price, i) => <g key={steps[i]}>
            <circle cx={x(i)} cy={y(price)} r={i === prices.length - 1 ? 9 : 6} fill={i === prices.length - 1 ? "#c8ff4a" : "#fff"} stroke="currentColor" strokeWidth="3"/>
            <text x={x(i)} y={y(price) - 16} textAnchor="middle" className="negotiation-price">{money(price)}</text>
            <text x={x(i)} y="138" textAnchor="middle" className="negotiation-step">{steps[i]}</text>
          </g>)}
        </svg>
      </div>;
    })}
  </div>;
}
