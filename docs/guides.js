// Simple build orders. Each step names a ROLE; the role is resolved to the right unit for the chosen faction.
// These are starting points, not gospel: BAR has no single "correct" build and the map decides a lot.
window.GUIDES = {
  roles: {
    mex:      { Armada: 'armmex',  Cortex: 'cormex',  Legion: 'legmex' },
    wind:     { Armada: 'armwin',  Cortex: 'corwin',  Legion: 'legwin' },
    solar:    { Armada: 'armsolar', Cortex: 'corsolar', Legion: 'legsolar' },
    botlab:   { Armada: 'armlab',  Cortex: 'corlab',  Legion: 'leglab' },
    vehlab:   { Armada: 'armvp',   Cortex: 'corvp',   Legion: 'legvp' },
    airlab:   { Armada: 'armap',   Cortex: 'corap',   Legion: 'legap' },
    conbot:   { Armada: 'armck',   Cortex: 'corck',   Legion: 'legck' },
    conveh:   { Armada: 'armcv',   Cortex: 'corcv',   Legion: 'legcv' },
    conair:   { Armada: 'armca',   Cortex: 'corca',   Legion: 'legca' },
    nano:     { Armada: 'armnanotc', Cortex: 'cornanotc', Legion: 'legnanotc' },
    conv:     { Armada: 'armmakr', Cortex: 'cormakr', Legion: 'legeconv' },
    llt:      { Armada: 'armllt',  Cortex: 'corllt',  Legion: 'leglht' },
    aa:       { Armada: 'armrl',   Cortex: 'corrl',   Legion: 'legrl' },
    radar:    { Armada: 'armrad',  Cortex: 'corrad',  Legion: 'legrad' },
    scout:    { Armada: 'armflea', Cortex: 'corfav',  Legion: 'legscout' },
    raider:   { Armada: 'armpw',   Cortex: 'corak',   Legion: 'leggob' },
    fighter:  { Armada: 'armfig',  Cortex: 'corveng', Legion: 'legfig' },
    advsolar: { Armada: 'armadvsol', Cortex: 'coradvsol', Legion: 'legadvsol' },
    fusion:   { Armada: 'armfus',  Cortex: 'corfus',  Legion: 'legfus' },
    t2bot:    { Armada: 'armalab', Cortex: 'coralab', Legion: 'legalab' },
    t2veh:    { Armada: 'armavp',  Cortex: 'coravp',  Legion: 'legavp' },
    t2con:    { Armada: 'armack',  Cortex: 'corack',  Legion: 'legack' },
    t2air:    { Armada: 'armaap', Cortex: 'coraap', Legion: 'legaap' },
    moho:     { Armada: 'armmoho', Cortex: 'cormoho', Legion: 'legmoho' },
    antinuke: { Armada: 'armamd',  Cortex: 'corfmd',  Legion: 'legabm' },
    shipyard: { Armada: 'armsy',   Cortex: 'corsy',   Legion: 'legsy' },
    tidal:    { Armada: 'armtide', Cortex: 'cortide', Legion: 'legtide' }
  },

  // What your first lab produces, by faction (used in the opener)
  flavor: {
    Armada: 'Armada opens with fast Pawn raiders out of the Bot Lab. Mobile and direct: good at picking off weak expansions.',
    Cortex: 'Cortex opens with Grunts out of the Bot Lab. Rugged line units that hold ground while you expand.',
    Legion: 'Legion opens with Goblins out of the Bot Lab. Check each unit page for its role before you commit to a mass.'
  },

  styles: [
    {
      id: 'opener', name: 'Opening', blurb: 'The first three minutes. Every game starts here, whatever the mode.',
      steps: [
        { r: 'mex', n: 2, t: 'on the nearest metal spots' },
        { r: 'wind', n: 3, t: 'inside your commander\'s build range. On a map with weak wind, build Solar Collectors (x2 to 3) instead.' },
        { r: 'mex', n: '2 to 3', t: 'more, working outward from the start' },
        { r: 'botlab', t: 'once your energy covers it without the stockpile hitting zero. Roughly 1:30 to 2:00 is typical. A Vehicle Plant works too.' },
        { r: 'conbot', n: 1, t: 'first unit out. A constructor can build things your commander can\'t, so it beats any army unit here.' },
        { r: 'scout', n: '2 to 5', t: 'cheap scouts to find the enemy and spot expansions' },
        { r: 'raider', n: '5 to 10', t: 'to take and hold metal, and to punish weak expansions' }
      ],
      tips: [
        'Judge your timing by whether your stockpile ever hit zero, not by a stopwatch. Energy sitting at zero means you built too much too fast.',
        'Keep the commander building. Let the lab make constructors and army so nothing sits idle.',
        'Rough targets for the first 3 minutes: 5 to 6 metal extractors, 5 to 8 metal/s, 15 to 30 energy/s. These are targets, not rules.'
      ]
    },
    {
      id: '1v1', name: '1v1', blurb: 'Two players, usually a small map. Contact comes early, so economy and scouting both matter.',
      steps: [
        { r: 'mex', n: '2 to 3', t: 'then the metal between you and your opponent, before they take it' },
        { r: 'wind', n: 3, t: 'or Solar Collectors on a low-wind map' },
        { r: 'botlab', t: 'around 1:30 to 2:00' },
        { r: 'scout', n: '2 or more', t: 'out before minute 2. Contact is common around minutes 3 to 4 on small maps.' },
        { r: 'conbot', n: '2 to 3', t: 'to keep expanding and to add energy' },
        { r: 'llt', n: 1, t: 'beside an exposed extractor against raiders. A parked unit does the same job. Do not chase scouts.' },
        { r: 'conv', t: 'once you have spare energy and metal is your limit' },
        { r: 'nano', t: 'next to your lab to speed up production' },
        { r: 'vehlab', t: 'second factory for a different unit mix' },
        { r: 'advsolar', t: 'first step to Tech 2: more energy' },
        { r: 't2bot', t: 'when you have about 15 metal/s and have held the front for 3 to 4 minutes. Alternatively the Advanced Vehicle Plant.' },
        { r: 't2con', t: 'to claim more metal and build Tech 2 energy' }
      ],
      tips: [
        'If you have more extractors than your opponent, expand and add turrets. If you have fewer, hit their newest expansion.',
        'Going Tech 2 order: energy, then the lab, then one run of the cheapest Tech 2 unit, then converters, then heavy units. If your front is collapsing mid-build, cancel the lab and keep making Tech 1.',
        'Fewer extractors than elapsed minutes usually means you are behind.'
      ]
    },
    {
      id: 'team-front', name: 'Team: Frontline', blurb: 'You hold the line. Your job is to claim the contested metal, stop pushes and give your team room to build.',
      steps: [
        { r: 'mex', n: '2 to 3', t: 'on the spots closest to the enemy first, then fall back to safer ones' },
        { r: 'wind', n: 3, t: 'or Solar Collectors on a low-wind map. Keep this small, your economy partner builds the big energy.' },
        { r: 'botlab', t: 'early, around 1:30 to 2:00. A Vehicle Plant is a fine choice if the ground is open.' },
        { r: 'conbot', n: 1, t: 'first out, then more as you expand' },
        { r: 'raider', n: '5 to 10', t: 'to take the middle and punish weak expansions' },
        { r: 'llt', t: 'in front of your extractors on the side the enemy comes from' },
        { r: 'radar', t: 'so your team sees pushes before they land' },
        { r: 'nano', t: 'next to the lab so reinforcements arrive faster' },
        { r: 'vehlab', t: 'second factory to mix unit types' },
        { r: 't2bot', t: 'once the line is stable and your economy partner is supplying energy' }
      ],
      tips: [
        'Your army is your teammates\' shield. If you lose the line, everyone behind you loses their economy.',
        'Do not over-extend. Hold a position, add turrets, then step forward.',
        'Ask your economy player for resources when you are about to run dry, not after.',
        'General team-game practice, not from the sources I checked. Adjust to the map.'
      ]
    },
    {
      id: 'team-eco', name: 'Team: Economy', blurb: 'You fund the team. A big, safe economy that you share is worth more than a second army.',
      steps: [
        { r: 'mex', n: '3', t: 'on your safe spots, then keep adding as far back as you can' },
        { r: 'wind', n: '3 to 6', t: 'or Solar Collectors on a low-wind map. Energy is your main product.' },
        { r: 'botlab', t: 'only to churn out constructors, not an army' },
        { r: 'conbot', n: '3 to 4', t: 'to expand and build energy at the same time' },
        { r: 'conv', n: '2 or more', t: 'when you have spare energy and metal is the limit' },
        { r: 'llt', t: 'a few at your extractors, enough to stop raiders' },
        { r: 'nano', t: 'to build energy faster' },
        { r: 'advsolar', t: 'upgrade your energy' },
        { r: 'fusion', t: 'for bigger energy once you can afford it' },
        { r: 't2con', t: 'to build Tech 2 economy and storage' },
        { r: 'moho', t: 'on your best metal spots' }
      ],
      tips: [
        'Your job is to supply the frontline. Share metal and energy with allies who are in the fight, and ask what they need.',
        'Keep energy from sitting at zero. If metal converters starve your builders of energy, you have too many converters.',
        'Check how much metal your map has before choosing energy converters. A metal-poor map needs far more of them.',
        'Keep a small defense and anti-air at home. An undefended economy is the first thing enemies target.',
        'General team-game practice, not from the sources I checked, except the converter note. Adjust to the map.'
      ]
    },
    {
      id: 'team-air', name: 'Team: Air', blurb: 'You own the sky. Protect your team from bombers and punish what the ground army cannot reach.',
      steps: [
        { r: 'mex', n: 2, t: 'on your own side' },
        { r: 'wind', n: 3, t: 'or Solar Collectors on a low-wind map. Aircraft are energy-hungry, so plan for more.' },
        { r: 'airlab', t: 'as your first factory' },
        { r: 'conair', n: 1, t: 'to expand without needing ground paths' },
        { r: 'fighter', n: '5 or more', t: 'to cover the team from enemy bombers and scouts' },
        { r: 'aa', t: 'a few at home for when your air is away' },
        { r: 'radar', t: 'so your fighters are in the right place' },
        { r: 'nano', t: 'to speed up the plant' },
        { r: 't2air', t: 'for stronger aircraft once your economy supports it' },
        { r: 't2con', t: 'to expand Tech 2 economy' }
      ],
      tips: [
        'If your team has no anti-air, enemy bombers can end the game quickly. Fighters are a team service, not just your own army.',
        'Aircraft cannot hold ground. Keep ground allies near you, or build a few turrets.',
        'Your enemies will build anti-air. Watch for it and change your approach before you lose your fleet.',
        'General team-game practice, not from the sources I checked. Adjust to the map.'
      ]
    },
    {
      id: 'ffa', name: 'Free for all', blurb: 'Everyone is a target. Surviving the first fights and out-growing the leaders wins.',
      steps: [
        { r: 'mex', n: '2 to 3', t: 'then take the spots nobody else can reach safely' },
        { r: 'wind', n: 3, t: 'or Solar Collectors on a low-wind map' },
        { r: 'botlab', t: 'for a few units to hold your own metal' },
        { r: 'conbot', n: 2, t: 'to keep expanding while others fight' },
        { r: 'llt', t: 'at your extractor clusters' },
        { r: 'aa', t: 'a few early, since aircraft are the easy way to hit a lone player' },
        { r: 'radar', t: 'to see who is coming from which side' },
        { r: 'advsolar', t: 'then Tech 2 energy. Outgrowing the other players is how you win a free for all, so do not stay on Tech 1 longer than you need to' },
        { r: 't2con', t: 'for Tech 2 economy and static defenses' },
        { r: 'moho', t: 'upgrade your best extractors' },
        { r: 'antinuke', t: 'late game, before someone builds a nuke silo' }
      ],
      tips: [
        'This one is general RTS advice. The community guides I checked do not cover free for all, so treat it as a starting idea.',
        'Don\'t be the first to start a fight. Two players trading units is good for everyone else.',
        'Attack the player who is weakest or who is distracted by someone else, not the strongest.',
        'Defend where you have extractors, since turrets at the base alone do not stop raids on your economy.'
      ]
    },
    {
      id: 'naval', name: 'Water maps', blurb: 'Land is cramped and water is the main road. Ships and tidal power replace the land opening.',
      steps: [
        { r: 'mex', n: 2, t: 'on land spots near your start' },
        { r: 'tidal', n: '3 to 4', t: 'on water, since wind and solar are weaker choices on many water maps' },
        { r: 'shipyard', t: 'your first factory on the shore' }
      ],
      tips: [
        'This outline comes from a single guide with no timings for the shipyard. Build it once your energy supports it, like any other first factory.',
        'Build a constructor ship, then underwater metal extractors where the map allows them.',
        'Put a sonar picket out early. Torpedo-armed units and submarines are invisible without it.'
      ]
    }
  ],

  mistakes: [
    'Building extractors and forgetting power, so everything builds slowly.',
    'Queuing army before the first constructor.',
    'Expanding without scouting.',
    'Staying on one metal cluster for too long.',
    'Going Tech 2 too early, then losing the front while the lab builds.',
    'Letting resources overflow while constructors sit idle.'
  ],

  sources: [
    ['GameHowTo: Beyond All Reason guide', 'https://gamehowto.com/game/beyond-all-reason/'],
    ['CRD: Economy build order optimization in Beyond All Reason', 'https://www.crdhq.com/articles/bar-economy-build-optimization']
  ]
};

function renderGuide() {
  const G = window.GUIDES, f = state.gfac, st = G.styles.find(s => s.id === state.gstyle) || G.styles[0];
  const unit = r => { const id = G.roles[r] && G.roles[r][f]; return id && byId[id] ? byId[id] : null; };
  const chip = r => { const u = unit(r); return u ? `<a class="uchip" tabindex="0" data-id="${u.id}" style="--c:${FCOL[f]}"><span class="art"><img src="img/${u.id}.webp" alt="" onerror="this.style.visibility='hidden'"></span>${u.name}</a>` : ''; };
  const fnav = ['Armada', 'Cortex', 'Legion'].map(x => `<button data-gf="${x}" aria-pressed="${x === f}" style="--c:${FCOL[x]}">${x}</button>`).join('');
  const snav = G.styles.map(s => `<button data-gs="${s.id}" aria-pressed="${s.id === st.id}">${s.name}</button>`).join('');
  const steps = st.steps.map(s => `<li><div class="stepmain">${chip(s.r)}<span class="qty">${s.n ? 'x ' + s.n : ''}</span></div><p>${s.t}</p></li>`).join('');
  $('#grid').innerHTML = `
    <div class="guide">
      <div class="gnav"><div class="seg2">${fnav}</div><div class="seg2 styles">${snav}</div></div>
      <h2 class="gh">${st.name}</h2>
      <p class="gb">${st.blurb}</p>
      ${st.id === 'opener' ? `<p class="gflav">${G.flavor[f]}</p>` : ''}
      <p><button class="vsswap" data-toplan="${st.id}">Open this build order in the planner</button></p>
      <ol class="steps">${steps}</ol>
      <h3>Tips</h3>
      <ul class="tips">${st.tips.map(t => `<li>${t}</li>`).join('')}</ul>
      <h3>Common mistakes</h3>
      <ul class="tips">${G.mistakes.map(t => `<li>${t}</li>`).join('')}</ul>
      <p class="gsrc">Based on ${G.sources.map(([n, u]) => `<a target="_blank" rel="noopener" href="${u}">${n}</a>`).join(' and ')}, plus general RTS practice. The numbers in those guides are approximate. Unit choices change with game patches.</p>
    </div>`;
}
