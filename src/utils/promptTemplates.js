export const HauntedHighSchoolTemplates = {
  // Atmospheric Settings
  hallway: [
    "Cinematic shot: {subjects} walking through a dimly lit, foggy high school hallway. Lockers on both sides glow with supernatural {color} light. Camera slowly pushes forward as ghostly figures appear in the background. {costume_integration}. Duration: {duration} seconds.",
    
    "Wide tracking shot: {subjects} moving down an endless haunted high school corridor. Lockers slam shut mysteriously as they pass. Flickering fluorescent lights create dramatic shadows. {supernatural_elements}. Camera follows alongside with smooth lateral movement. Duration: {duration} seconds.",
    
    "Low-angle shot: {subjects} standing in a misty high school hallway as ghostly students pass through the walls behind them. Emergency exit signs flicker ominously. {costume_integration}. Camera slowly tilts up revealing the infinite ceiling. Duration: {duration} seconds."
  ],

  cafeteria: [
    "Wide shot: {subjects} in a haunted high school cafeteria. Tables and chairs float mysteriously in the air around them. Soft supernatural glow emanates from the kitchen area. Camera circles the group as ghostly lunch ladies appear in the background. {mood} atmosphere. Duration: {duration} seconds.",
    
    "Medium shot: {subjects} sitting at a cafeteria table as phantom food trays glide past them. The lunch line moves by itself with invisible students. {costume_integration}. Camera slowly dollies in as ethereal cafeteria sounds echo. Duration: {duration} seconds.",
    
    "Overhead shot: {subjects} in the center of a spectral cafeteria where ghostly students flicker in and out of existence at surrounding tables. {supernatural_elements}. Camera descends slowly as supernatural mist swirls around their feet. Duration: {duration} seconds."
  ],

  library: [
    "Cinematic shot: {subjects} in a haunted library as books float off shelves around them. Ghostly librarian shadows move between the stacks. {costume_integration}. Camera glides through floating books with ethereal lighting. Duration: {duration} seconds.",
    
    "Wide shot: {subjects} surrounded by spectral students studying at glowing library tables. Books open and close by themselves. Phantom whispers echo. {supernatural_elements}. Camera slowly orbits the scene as pages flutter mysteriously. Duration: {duration} seconds.",
    
    "Medium shot: {subjects} reading ancient books that glow with supernatural energy. Ghostly hands turn invisible pages around them. {mood} lighting from enchanted reading lamps. Camera pushes in as spectral knowledge swirls visibly. Duration: {duration} seconds."
  ],

  gymnasium: [
    "Wide shot: {subjects} in a haunted gymnasium where ghostly athletes play invisible sports. Bleachers extend infinitely upward filled with phantom spectators. {costume_integration}. Camera swoops dramatically from floor to ceiling. Duration: {duration} seconds.",
    
    "Cinematic shot: {subjects} standing center court as spectral cheerleaders perform ethereal routines. Phantom basketball bounces by itself. {supernatural_elements}. Camera circles them as ghostly school spirit energy radiates outward. Duration: {duration} seconds.",
    
    "Low-angle shot: {subjects} on the gymnasium floor as ghostly graduation ceremonies happen simultaneously on floating stages above. {costume_integration}. Camera tilts up revealing infinite layers of supernatural school events. Duration: {duration} seconds."
  ],

  classroom: [
    "Medium shot: {subjects} in a haunted classroom where ghostly students take eternal exams. Chalkboards write themselves with supernatural equations. {costume_integration}. Camera slowly tracks past floating desks as spectral pencils write invisible answers. Duration: {duration} seconds.",
    
    "Wide shot: {subjects} as phantom teachers give lectures to invisible classes. Ghostly students raise translucent hands. {supernatural_elements}. Camera glides between rows of spectral desks as ethereal knowledge flows visually. Duration: {duration} seconds.",
    
    "Close-up to wide: Starting tight on {subjects}, camera pulls back to reveal them in a classroom filled with ghostly students from different decades. {mood} lighting from supernatural projectors. Duration: {duration} seconds."
  ],

  prom: [
    "Cinematic shot: {subjects} in a spectral prom where ghostly couples dance eternally. Phantom disco balls cast supernatural light patterns. {costume_integration}. Camera spirals around the ethereal dance floor as ghostly music plays. Duration: {duration} seconds.",
    
    "Wide shot: {subjects} crowned as supernatural prom royalty while ghostly classmates applaud from glowing bleachers. {supernatural_elements}. Camera pushes forward through floating confetti as spectral cameras flash. Duration: {duration} seconds.",
    
    "Medium shot: {subjects} slow dancing as phantom prom-goers from different eras appear and disappear around them. {mood} lighting from enchanted decorations. Camera slowly circles as temporal school memories swirl visually. Duration: {duration} seconds."
  ]
};

export const PromptGenerator = {
  generatePrompt(analysis) {
    const { people, costumes, setting, composition } = analysis;
    
    // Select appropriate template category
    const categories = Object.keys(HauntedHighSchoolTemplates);
    const category = this.selectCategory(analysis);
    const templates = HauntedHighSchoolTemplates[category];
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    // Generate template variables
    const variables = this.generateVariables(analysis);
    
    // Replace template placeholders
    let prompt = template;
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{${key}}`, 'g');
      prompt = prompt.replace(regex, variables[key]);
    });
    
    return prompt;
  },

  selectCategory(analysis) {
    const { composition, setting, people } = analysis;
    
    // Logic to select most appropriate setting based on analysis
    if (people.count >= 4) return 'cafeteria';
    if (setting.mood === 'elegant') return 'prom';
    if (composition.energy === 'high') return 'gymnasium';
    if (setting.mood === 'mysterious') return 'library';
    
    // Default to hallway for versatility
    return 'hallway';
  },

  generateVariables(analysis) {
    const { people, costumes, setting, composition } = analysis;
    
    return {
      subjects: this.generateSubjectDescription(people, costumes),
      costume_integration: this.generateCostumeIntegration(costumes),
      supernatural_elements: this.generateSupernaturalElements(setting, composition),
      mood: setting.mood || 'eerie',
      color: this.selectMysticalColor(setting),
      duration: this.selectDuration(composition.energy)
    };
  },

  generateSubjectDescription(people, costumes) {
    const count = people.count;
    const costumes_desc = costumes.map(c => c.theme).join(' and ');
    
    if (count === 1) return `A person in ${costumes_desc} costume`;
    if (count === 2) return `Two people in ${costumes_desc} costumes`;
    if (count <= 4) return `A small group of ${count} people in ${costumes_desc} costumes`;
    return `A large group of ${count} people in elaborate Halloween costumes`;
  },

  generateCostumeIntegration(costumes) {
    const themes = [...new Set(costumes.map(c => c.theme))];
    
    const integrations = {
      horror: "Their terrifying costumes blend seamlessly with the supernatural school atmosphere",
      fantasy: "Mystical elements from their costumes create magical auras that interact with ghostly school spirits",
      'pop-culture': "Their iconic costumes transform into legendary school supernatural figures",
      classic: "Their timeless Halloween costumes become part of the eternal school haunting",
      funny: "Their humorous costumes add whimsical charm to the supernatural school setting",
      creative: "Their unique costumes merge with the school's ghostly energy creating original supernatural forms"
    };
    
    return integrations[themes[0]] || integrations.classic;
  },

  generateSupernaturalElements(setting, composition) {
    const elements = [
      "Ethereal school bells chime from nowhere",
      "Phantom backpacks float through the air", 
      "Ghostly school announcements echo mysteriously",
      "Spectral homework papers swirl in supernatural wind",
      "Invisible school buses arrive and depart constantly",
      "Phantom hall passes glow and move by themselves",
      "Supernatural school mascot spirits dance around them",
      "Ethereal yearbook photos come to life on the walls"
    ];
    
    return elements[Math.floor(Math.random() * elements.length)];
  },

  selectMysticalColor(setting) {
    const colors = {
      bright: 'golden',
      dim: 'blue',
      dramatic: 'purple',
      natural: 'green'
    };
    
    return colors[setting.lighting] || 'blue';
  },

  selectDuration(energy) {
    const durations = {
      high: 5,
      medium: 6,
      low: 7
    };
    
    return durations[energy] || 6;
  }
};

export const FallbackPrompts = [
  "Cinematic shot: Group of Halloween party-goers walking through a mystical high school hallway filled with floating lockers and ghostly students. Supernatural blue light emanates from classroom doors. Camera glides forward as spectral homecoming banners wave mysteriously. Duration: 6 seconds.",
  
  "Wide shot: Friends in Halloween costumes standing in a haunted cafeteria where phantom lunch trays orbit around them. Ghostly cafeteria workers serve invisible food. Camera slowly circles as supernatural school spirit energy radiates throughout. Duration: 7 seconds.",
  
  "Medium shot: Halloween celebrants in a spectral library where ancient yearbooks flip their pages automatically. Ghostly students from past decades study at glowing desks. Camera pushes in as ethereal school memories swirl visually around them. Duration: 5 seconds."
];