import Link from "next/link";
import { ArrowRight, ArrowUpRight, Braces, Check, Database, GitBranch, Layers3, MessageCircle, Search, ShieldCheck, SlidersHorizontal, Sparkles, Workflow, Zap } from "lucide-react";

const demoHref = "/dashboard?view=activity";
const githubHref = "https://github.com/benikigai/JEVgotiator";

const flow = [
  { icon: MessageCircle, name: "Send a message", detail: "iMessage via Photon", tag: "01" },
  { icon: Sparkles, name: "Clarify the brief", detail: "Eve agent", tag: "02" },
  { icon: Workflow, name: "Start the search", detail: "Search API", tag: "03" },
  { icon: SlidersHorizontal, name: "Apply constraints", detail: "Budget, year, miles", tag: "04" },
  { icon: Zap, name: "Score the fit", detail: "Jev model", tag: "05" },
  { icon: Search, name: "Compare the top 5", detail: "You pick 1 to 3", tag: "06" },
  { icon: SlidersHorizontal, name: "Compare your picks", detail: "Dara’s scoring", tag: "07" },
  { icon: ShieldCheck, name: "Explore a plan", detail: "Practice negotiation", tag: "08" },
];

const stack = [
  { icon: Braces, title: "The dashboard", tech: "Next.js 16 · TypeScript · Zod", text: "One web app for search, comparison, Jev’s decision trace, and live iMessage activity." },
  { icon: MessageCircle, title: "The conversation", tech: "Photon · Eve 0.67", text: "iMessages reach an agent that clarifies what you want, then runs the search and planning tools." },
  { icon: Zap, title: "The decision layer", tech: "TypeSafe · Jev 1.13", text: "Jev scores how well each listing fits you. Every question, answer, and weight is visible." },
  { icon: Database, title: "The demo inventory", tech: "1,000 sample Tesla listings", text: "A repeatable test catalog for the full flow. Chris’s real catalog is not connected yet." },
  { icon: Layers3, title: "The runtime", tech: "Vercel · Railway", text: "Vercel runs the Eve agent. Railway runs the dashboard and search API." },
  { icon: ShieldCheck, title: "The intelligence layer", tech: "Dara’s scoring, labeled practice run", text: "Dara’s rules compare your picks. A separate practice timeline shows how an offer could go. No seller is contacted." },
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
          <div className="landing-eyebrow"><span /> Built at JEVathon, San Francisco</div>
          <h1>Your next Tesla.<br /><span>Your terms.</span></h1>
          <p className="landing-intro">Text us what you want. We turn 1,000 listings into five good picks, and give you a plan for the deal.</p>
          <div className="landing-actions"><Link className="landing-button landing-button-dark" href={demoHref}>Open demo dashboard <ArrowUpRight size={19} /></Link><a className="landing-text-link" href="#architecture">See how it works <ArrowRight size={17} /></a></div>
          <p className="landing-access-note">Demo code required. Sample inventory, real model scoring.</p>
        </div>
        <div className="landing-hero-art">
          <div className="landing-art-top"><span>How we search</span><span className="landing-art-chip"><Zap size={13} /> Scored by Jev</span></div>
          <CarIllustration />
          <div className="landing-art-bottom"><span>Less scrolling.<br /><strong>More signal.</strong></span><div className="landing-art-seal"><ArrowUpRight size={29} /></div></div>
          <span className="landing-illustration-label">Illustration. Sample inventory.</span>
        </div>
      </section>

      <section className="landing-stats landing-shell" aria-label="Demo scope">
        <div><strong>1,000<span> Teslas</span></strong><p>Sample listings in the demo</p></div>
        <div><strong>30<span> candidates</span></strong><p>Cars Jev scores per search</p></div>
        <div><strong>5<span> matches</span></strong><p>Cars in your shortlist</p></div>
        <div><strong>1–3<span> picks</span></strong><p>Cars you take to the deal</p></div>
      </section>

      <section className="landing-architecture" id="architecture">
        <div className="landing-shell">
          <div className="landing-section-heading"><div><span className="landing-kicker">How it works</span><h2>A clear path to a better deal.</h2></div><p>Code applies your limits. Jev scores the fit. You choose.</p></div>
          <ol className="landing-flow">{flow.map(({ icon: Icon, name, detail, tag }, index) => <li key={name} className={index === 4 ? "landing-flow-jev" : ""}><div className="landing-flow-top"><Icon size={23} strokeWidth={1.6} /><span>{tag}</span></div><h3>{name}</h3><p>{detail}</p>{index < flow.length - 1 && <ArrowRight className="landing-flow-arrow" size={16} />}</li>)}</ol>
          <div className="landing-principles">
            <article><span className="landing-principle-number">1. Filter</span><h3>Start with the non-negotiables.</h3><p>Budget, mileage, year, and location cut the list first. No model touches those rules.</p></article>
            <article><span className="landing-principle-number">2. Understand</span><h3>Show what Jev actually did.</h3><p>See the exact questions Jev was asked, the scores it returned, and how they add up. Missing facts stay marked as unknown.</p></article>
            <article><span className="landing-principle-number">3. Decide</span><h3>Keep the buyer in the loop.</h3><p>Pick up to three cars. Dara’s rules compare them, then a clearly labeled practice run walks through an offer. No seller is contacted.</p></article>
          </div>
        </div>
      </section>

      <section className="landing-stack landing-shell" id="stack">
        <div className="landing-section-heading"><div><span className="landing-kicker">The stack</span><h2>Small team. Connected system.</h2></div><p>What is built and running today.</p></div>
        <div className="landing-stack-grid">{stack.map(({ icon: Icon, title, tech, text }) => <article className="landing-stack-card" key={title}><div className="landing-stack-icon"><Icon size={21} strokeWidth={1.7} /></div><h3>{title}</h3><span className="landing-tech">{tech}</span><p>{text}</p></article>)}</div>
        <div className="landing-proof"><div className="landing-proof-icon"><Check size={20} /></div><p><strong>Working today:</strong> live Jev scoring, a real iMessage reply, and live conversation activity. Dara’s rules run. Counteroffers and final prices in the demo are assumptions. Real catalog data and seller outreach are not connected yet.</p><a href={githubHref} target="_blank" rel="noreferrer">Read the source <ArrowUpRight size={16} /></a></div>
      </section>

      <section className="landing-team landing-shell" id="team"><div><span className="landing-kicker">The team</span><h2>Built together.</h2></div><div className="landing-team-members"><div><span className="landing-avatar">B</span><p><strong>Ben</strong><span>Integration & product</span></p></div><div><span className="landing-avatar">C</span><p><strong>Chris</strong><span>Data & catalog</span></p></div><div><span className="landing-avatar">D</span><p><strong>Dara</strong><span>Optimization</span></p></div></div></section>

      <section className="landing-bottom-cta landing-shell"><div><span className="landing-kicker">Try it</span><h2>See the decisions behind the shortlist.</h2><p>Search, read Jev’s trace, and watch the conversation in the team demo.</p></div><Link className="landing-button landing-button-lime" href={demoHref}>Open demo dashboard <ArrowUpRight size={19} /></Link></section>
    </main>
    <footer className="landing-footer landing-shell"><span>JEVgotiator. Built at JEVathon, San Francisco.</span><a href={githubHref} target="_blank" rel="noreferrer">View on GitHub <ArrowUpRight size={14} /></a></footer>
  </div>;
}
