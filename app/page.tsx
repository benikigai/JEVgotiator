import Link from "next/link";
import { ArrowRight, ArrowUpRight, Braces, Check, Database, GitBranch, Layers3, MessageCircle, Search, ShieldCheck, SlidersHorizontal, Sparkles, Workflow, Zap } from "lucide-react";
import "./landing.css";
import "./landing-polish.css";

const demoHref = "/dashboard?view=activity";
const githubHref = "https://github.com/benikigai/JEVgotiator";

const flow = [
  { icon: MessageCircle, name: "Send a message", detail: "Photon · iMessage", tag: "01" },
  { icon: Sparkles, name: "Clarify the brief", detail: "Eve · Vercel", tag: "02" },
  { icon: Workflow, name: "Start the search", detail: "Railway API", tag: "03" },
  { icon: SlidersHorizontal, name: "Apply constraints", detail: "Deterministic filters", tag: "04" },
  { icon: Zap, name: "Score the fit", detail: "TypeSafe · Jev", tag: "05" },
  { icon: Search, name: "Compare the top 5", detail: "Buyer selects 1–3", tag: "06" },
  { icon: SlidersHorizontal, name: "Compare your picks", detail: "Dara intelligence", tag: "07" },
  { icon: ShieldCheck, name: "Explore a plan", detail: "Simulated negotiation", tag: "08" },
];

const stack = [
  { icon: Braces, title: "The dashboard", tech: "Next.js 16 · TypeScript · Zod", text: "A shared web interface for search, comparison, decision traces, and conversation activity." },
  { icon: MessageCircle, title: "The conversation", tech: "Photon · Eve 0.67", text: "Signed iMessage webhooks reach an agent that clarifies the brief and calls search and planning tools." },
  { icon: Zap, title: "The decision layer", tech: "TypeSafe · Jev 1.13", text: "Bounded model calls score preference fit from listing evidence. Questions, answers, and score composition are visible." },
  { icon: Database, title: "The demo inventory", tech: "1,000 synthetic Tesla listings", text: "A repeatable test catalog for the full search flow. Chris’s real catalog integration is still pending." },
  { icon: Layers3, title: "The runtime", tech: "Vercel · Railway", text: "Vercel serves the dashboard and Eve agent. Eve calls the Railway API for the search and planning workflow." },
  { icon: ShieldCheck, title: "The intelligence layer", tech: "Dara’s scoring · Disclosed simulation", text: "Dara’s weighted rules compare your selected cars. A separate synthetic-only offer timeline demonstrates negotiation; no seller is contacted." },
];

function CarIllustration() {
  return <svg viewBox="0 0 680 390" role="img" aria-label="Illustration of an electric car on a winding San Francisco road" className="landing-car">
    <defs>
      <linearGradient id="landing-car-paint" x1="0" y1="0" x2="0.8" y2="1"><stop stopColor="#fffef7" /><stop offset="1" stopColor="#bbbfb2" /></linearGradient>
      <linearGradient id="landing-car-glass" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#477466" /><stop offset="1" stopColor="#153a30" /></linearGradient>
    </defs>
    <circle cx="477" cy="104" r="66" fill="#dafa83" opacity=".8" />
    <path d="M0 192 75 128 155 170 262 73 370 164 486 102 680 197V390H0Z" fill="#bed0b7" />
    <path d="M0 238 128 184 229 228 360 156 480 235 680 153V390H0Z" fill="#8fac91" />
    <path d="M445 185C289 211 594 237 428 289S124 320 89 390" fill="none" stroke="#dce4d6" strokeWidth="67" />
    <path d="M445 185C289 211 594 237 428 289S124 320 89 390" fill="none" stroke="#f9faf1" strokeWidth="2" strokeDasharray="12 15" />
    <ellipse cx="355" cy="307" rx="231" ry="23" fill="#173b30" opacity=".16" />
    <path d="M118 262 140 232 230 206 286 158Q300 147 322 147H414Q443 148 466 173L516 220 567 235Q584 240 587 262L580 286H116Z" fill="url(#landing-car-paint)" stroke="#53685b" strokeWidth="2" />
    <path d="m247 208 50-49h113q18 0 35 16l45 41-129-8Z" fill="url(#landing-car-glass)" />
    <path d="m355 158 4 50m-13 4-5 62m140-57 20 57" fill="none" stroke="#98a99c" strokeWidth="2" />
    <path d="M122 257q75-31 191-29l256 14m-411 35h353" fill="none" stroke="#fff" strokeOpacity=".66" strokeWidth="3" />
    <path d="m123 257 42-7-13 11-31 4m411-21 40 7 3 10-32-5" fill="#e4f1d1" />
    <path d="m318 228 18-1m130 4 17 1" stroke="#51675b" strokeWidth="4" strokeLinecap="round" />
    {[207, 506].map((x) => <g key={x}><circle cx={x} cy="283" r="40" fill="#18342b" /><circle cx={x} cy="283" r="26" fill="#899489" /><circle cx={x} cy="283" r="18" fill="#dce1d6" /><circle cx={x} cy="283" r="7" fill="#617467" /><path d={`M${x} 260v46m-23-23h46m-39-16 32 32m0-32-32 32`} stroke="#899489" strokeWidth="3" /></g>)}
    <path d="m248 210-17-5-8 8 15 5" fill="#dce1d6" stroke="#53685b" />
  </svg>;
}

export default function Page() {
  return <div className="landing">
    <header className="landing-header landing-shell">
      <Link href="/" className="landing-brand" aria-label="JEVgotiator home"><span className="landing-brand-mark"><ArrowUpRight size={23} strokeWidth={2.7} /></span>JEVgotiator<span className="landing-brand-dot">.</span></Link>
      <nav className="landing-nav" aria-label="Main navigation"><a href="#architecture">How it works</a><a href="#stack">The stack</a><a href="#team">The team</a></nav>
      <a className="landing-github" href={githubHref} target="_blank" rel="noreferrer"><GitBranch size={16} /> Source <ArrowUpRight size={15} /></a>
    </header>

    <main>
      <section className="landing-hero landing-shell">
        <div className="landing-hero-copy">
          <div className="landing-eyebrow"><span /> BUILT AT JEVATHON · SAN FRANCISCO</div>
          <h1>Your next Tesla.<br /><span>Your terms.</span></h1>
          <p className="landing-intro">Text what you need. Turn a thousand listings into a shortlist you can explain, and a negotiation plan you can act on.</p>
          <div className="landing-actions"><Link className="landing-button landing-button-dark" href={demoHref}>Open demo dashboard <ArrowUpRight size={19} /></Link><a className="landing-text-link" href="#architecture">See how it works <ArrowRight size={17} /></a></div>
          <p className="landing-access-note">Team demo code required. Synthetic inventory, real model inference.</p>
        </div>
        <div className="landing-hero-art">
          <div className="landing-art-top"><span>THE SEARCH, REIMAGINED</span><span className="landing-art-chip"><Zap size={13} /> Powered by Jev</span></div>
          <CarIllustration />
          <div className="landing-art-bottom"><span>Less scrolling.<br /><strong>More signal.</strong></span><div className="landing-art-seal"><ArrowUpRight size={29} /></div></div>
          <span className="landing-illustration-label">Product illustration · synthetic inventory</span>
        </div>
      </section>

      <section className="landing-stats landing-shell" aria-label="Demo scope">
        <div><strong>1,000<span> Teslas</span></strong><p>Synthetic demo inventory</p></div>
        <div><strong>30<span> candidates</span></strong><p>Maximum per Jev scoring call</p></div>
        <div><strong>5<span> matches</span></strong><p>Maximum shortlist size</p></div>
        <div><strong>1–3<span> picks</span></strong><p>Your choices for a buying plan</p></div>
      </section>

      <section className="landing-architecture" id="architecture">
        <div className="landing-shell">
          <div className="landing-section-heading"><div><span className="landing-kicker">FROM MESSAGE TO MOMENTUM</span><h2>A clear path to a better deal.</h2></div><p>Code handles your constraints. Jev evaluates the fit. You make the choice.</p></div>
          <ol className="landing-flow">{flow.map(({ icon: Icon, name, detail, tag }, index) => <li key={name} className={index === 4 ? "landing-flow-jev" : ""}><div className="landing-flow-top"><Icon size={23} strokeWidth={1.6} /><span>{tag}</span></div><h3>{name}</h3><p>{detail}</p>{index < flow.length - 1 && <ArrowRight className="landing-flow-arrow" size={16} />}</li>)}</ol>
          <div className="landing-principles">
            <article><span className="landing-principle-number">01 / FILTER</span><h3>Start with the non-negotiables.</h3><p>Budget, mileage, year, and location narrow the catalog before any model scoring. Hard constraints stay in code.</p></article>
            <article><span className="landing-principle-number">02 / UNDERSTAND</span><h3>Show what Jev actually did.</h3><p>Inspect the exact questions, listing context, returned scores, and final weighted ranking. Missing evidence stays unknown.</p></article>
            <article><span className="landing-principle-number">03 / DECIDE</span><h3>Keep the buyer in the loop.</h3><p>Choose up to three cars. Dara’s intelligence weights value, evidence, model fit, and other signals, then a labeled simulation explores an offer timeline. No seller is contacted.</p></article>
          </div>
        </div>
      </section>

      <section className="landing-stack landing-shell" id="stack">
        <div className="landing-section-heading"><div><span className="landing-kicker">UNDER THE HOOD</span><h2>Small team. Connected system.</h2></div><p>Purpose-built components, one buying workflow. Here is what is implemented today.</p></div>
        <div className="landing-stack-grid">{stack.map(({ icon: Icon, title, tech, text }) => <article className="landing-stack-card" key={title}><div className="landing-stack-icon"><Icon size={21} strokeWidth={1.7} /></div><h3>{title}</h3><span className="landing-tech">{tech}</span><p>{text}</p></article>)}</div>
        <div className="landing-proof"><div className="landing-proof-icon"><Check size={20} /></div><p><strong>A working prototype, with visible boundaries.</strong> Live Jev inference, a real iMessage reply, and conversation activity have been verified. Dara’s rules are implemented; demo counteroffers and settlement figures are explicit assumptions. Real catalog data and seller outreach remain pending.</p><a href={githubHref} target="_blank" rel="noreferrer">Read the source <ArrowUpRight size={16} /></a></div>
      </section>

      <section className="landing-team landing-shell" id="team"><div><span className="landing-kicker">THREE PEOPLE. ONE WORKFLOW.</span><h2>Built together.</h2></div><div className="landing-team-members"><div><span className="landing-avatar">B</span><p><strong>Ben</strong><span>Integration & product</span></p></div><div><span className="landing-avatar">C</span><p><strong>Chris</strong><span>Data & catalog</span></p></div><div><span className="landing-avatar">D</span><p><strong>Dara</strong><span>Optimization</span></p></div></div></section>

      <section className="landing-bottom-cta landing-shell"><div><span className="landing-kicker">TAKE THE DRIVER’S SEAT</span><h2>See the decisions behind the shortlist.</h2><p>Explore search, Jev traces, and conversation activity in the team demo.</p></div><Link className="landing-button landing-button-lime" href={demoHref}>Open demo dashboard <ArrowUpRight size={19} /></Link></section>
    </main>
    <footer className="landing-footer landing-shell"><span>JEVgotiator. Built at JEVathon, San Francisco.</span><a href={githubHref} target="_blank" rel="noreferrer">View on GitHub <ArrowUpRight size={14} /></a></footer>
  </div>;
}
