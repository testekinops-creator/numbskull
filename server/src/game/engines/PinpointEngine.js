// Pinpoint — LinkedIn-style "guess the connection". Each round hides a CATEGORY
// and reveals its five clue words one at a time; the player picks the connecting
// category from four options (the answer + three random decoy category names).
// The fewer clues you've seen when you answer correctly, the more points you earn.
// The engine owns round generation + answer checking; scoring and progression
// live in the caller (matchHandlers for multiplayer) so the answer — and the
// not-yet-revealed clues — never leave the server until they should.

// ~100 categories, each with exactly five members. Kept deliberately distinct so
// three random decoys are unambiguous and a single clue could plausibly belong to
// only one of the four options.
export const CATEGORIES = [
  { name: 'Planets', clues: ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Neptune'] },
  { name: 'Chess pieces', clues: ['Pawn', 'Knight', 'Bishop', 'Rook', 'King'] },
  { name: 'Primary & secondary colors', clues: ['Red', 'Yellow', 'Blue', 'Green', 'Orange'] },
  { name: 'Oceans', clues: ['Pacific', 'Atlantic', 'Indian', 'Arctic', 'Southern'] },
  { name: 'Continents', clues: ['Africa', 'Asia', 'Europe', 'Antarctica', 'Australia'] },
  { name: 'Pizza toppings', clues: ['Pepperoni', 'Mushroom', 'Olives', 'Onion', 'Basil'] },
  { name: 'James Bond actors', clues: ['Connery', 'Moore', 'Dalton', 'Brosnan', 'Craig'] },
  { name: 'Greek gods', clues: ['Zeus', 'Hera', 'Apollo', 'Athena', 'Poseidon'] },
  { name: 'Shades of blue', clues: ['Navy', 'Cyan', 'Teal', 'Azure', 'Cobalt'] },
  { name: 'Card suits', clues: ['Hearts', 'Spades', 'Clubs', 'Diamonds', 'Joker'] },
  { name: 'Days of the week', clues: ['Monday', 'Tuesday', 'Friday', 'Saturday', 'Sunday'] },
  { name: 'Months', clues: ['January', 'March', 'June', 'August', 'October'] },
  { name: 'Zodiac signs', clues: ['Aries', 'Leo', 'Virgo', 'Scorpio', 'Pisces'] },
  { name: 'Tennis Grand Slams', clues: ['Wimbledon', 'US Open', 'French Open', 'Australian Open', 'Roland Garros'] },
  { name: 'Periodic table metals', clues: ['Iron', 'Copper', 'Gold', 'Zinc', 'Nickel'] },
  { name: 'Noble gases', clues: ['Helium', 'Neon', 'Argon', 'Krypton', 'Xenon'] },
  { name: 'Shapes', clues: ['Circle', 'Square', 'Triangle', 'Hexagon', 'Pentagon'] },
  { name: 'Citrus fruits', clues: ['Orange', 'Lemon', 'Lime', 'Grapefruit', 'Mandarin'] },
  { name: 'Berries', clues: ['Strawberry', 'Blueberry', 'Raspberry', 'Blackberry', 'Cranberry'] },
  { name: 'Breakfast foods', clues: ['Pancakes', 'Cereal', 'Toast', 'Omelette', 'Waffles'] },
  { name: 'Pasta shapes', clues: ['Penne', 'Fusilli', 'Spaghetti', 'Ravioli', 'Lasagne'] },
  { name: 'Coffee drinks', clues: ['Latte', 'Espresso', 'Cappuccino', 'Mocha', 'Americano'] },
  { name: 'Big cats', clues: ['Lion', 'Tiger', 'Leopard', 'Cheetah', 'Jaguar'] },
  { name: 'Primates', clues: ['Gorilla', 'Chimpanzee', 'Orangutan', 'Baboon', 'Lemur'] },
  { name: 'Reptiles', clues: ['Snake', 'Lizard', 'Crocodile', 'Turtle', 'Gecko'] },
  { name: 'Birds of prey', clues: ['Eagle', 'Hawk', 'Falcon', 'Owl', 'Vulture'] },
  { name: 'Sea creatures', clues: ['Octopus', 'Dolphin', 'Jellyfish', 'Seahorse', 'Stingray'] },
  { name: 'Insects', clues: ['Ant', 'Beetle', 'Dragonfly', 'Grasshopper', 'Butterfly'] },
  { name: 'Dog breeds', clues: ['Poodle', 'Beagle', 'Bulldog', 'Labrador', 'Dachshund'] },
  { name: 'Musical instruments', clues: ['Violin', 'Trumpet', 'Flute', 'Piano', 'Cello'] },
  { name: 'String instruments', clues: ['Guitar', 'Harp', 'Banjo', 'Mandolin', 'Ukulele'] },
  { name: 'Percussion', clues: ['Drum', 'Cymbal', 'Tambourine', 'Xylophone', 'Bongo'] },
  { name: 'Olympic sports', clues: ['Swimming', 'Gymnastics', 'Fencing', 'Archery', 'Rowing'] },
  { name: 'Team ball sports', clues: ['Basketball', 'Football', 'Cricket', 'Hockey', 'Volleyball'] },
  { name: 'Martial arts', clues: ['Judo', 'Karate', 'Taekwondo', 'Boxing', 'Aikido'] },
  { name: 'Water sports', clues: ['Surfing', 'Kayaking', 'Sailing', 'Diving', 'Waterpolo'] },
  { name: 'Winter sports', clues: ['Skiing', 'Snowboarding', 'Curling', 'Bobsled', 'Luge'] },
  { name: 'Shakespeare plays', clues: ['Hamlet', 'Macbeth', 'Othello', 'Tempest', 'King Lear'] },
  { name: 'Greek letters', clues: ['Alpha', 'Beta', 'Gamma', 'Delta', 'Omega'] },
  { name: 'Roman numerals', clues: ['I', 'V', 'X', 'L', 'C'] },
  { name: 'Phonetic alphabet', clues: ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'] },
  { name: 'Programming languages', clues: ['Python', 'Java', 'Rust', 'Ruby', 'Swift'] },
  { name: 'Web browsers', clues: ['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera'] },
  { name: 'Social media apps', clues: ['Instagram', 'TikTok', 'LinkedIn', 'Snapchat', 'Reddit'] },
  { name: 'Tech giants', clues: ['Apple', 'Google', 'Microsoft', 'Amazon', 'Meta'] },
  { name: 'Operating systems', clues: ['Windows', 'Linux', 'Android', 'macOS', 'iOS'] },
  { name: 'Renaissance artists', clues: ['Da Vinci', 'Michelangelo', 'Raphael', 'Titian', 'Donatello'] },
  { name: 'Impressionist painters', clues: ['Monet', 'Renoir', 'Degas', 'Manet', 'Cezanne'] },
  { name: 'Classical composers', clues: ['Mozart', 'Beethoven', 'Bach', 'Chopin', 'Vivaldi'] },
  { name: 'The Beatles', clues: ['John', 'Paul', 'George', 'Ringo', 'Liverpool'] },
  { name: 'Harry Potter houses', clues: ['Gryffindor', 'Slytherin', 'Hufflepuff', 'Ravenclaw', 'Hogwarts'] },
  { name: 'Star Wars characters', clues: ['Luke', 'Leia', 'Yoda', 'Vader', 'Chewbacca'] },
  { name: 'Marvel Avengers', clues: ['Iron Man', 'Thor', 'Hulk', 'Captain America', 'Black Widow'] },
  { name: 'Disney princesses', clues: ['Ariel', 'Belle', 'Jasmine', 'Cinderella', 'Mulan'] },
  { name: 'Friends characters', clues: ['Ross', 'Rachel', 'Monica', 'Chandler', 'Phoebe'] },
  { name: 'Simpsons family', clues: ['Homer', 'Marge', 'Bart', 'Lisa', 'Maggie'] },
  { name: 'Seven dwarfs', clues: ['Doc', 'Grumpy', 'Sleepy', 'Bashful', 'Happy'] },
  { name: 'Monopoly tokens', clues: ['Top hat', 'Thimble', 'Boot', 'Battleship', 'Dog'] },
  { name: 'Board games', clues: ['Chess', 'Checkers', 'Scrabble', 'Cluedo', 'Risk'] },
  { name: 'Playing card ranks', clues: ['Ace', 'Jack', 'Queen', 'King', 'Ten'] },
  { name: 'US presidents', clues: ['Lincoln', 'Washington', 'Roosevelt', 'Kennedy', 'Obama'] },
  { name: 'Ancient wonders', clues: ['Pyramids', 'Colossus', 'Lighthouse', 'Hanging Gardens', 'Mausoleum'] },
  { name: 'European capitals', clues: ['Paris', 'Rome', 'Berlin', 'Madrid', 'Vienna'] },
  { name: 'Asian capitals', clues: ['Tokyo', 'Beijing', 'Seoul', 'Bangkok', 'Delhi'] },
  { name: 'African countries', clues: ['Kenya', 'Egypt', 'Nigeria', 'Morocco', 'Ghana'] },
  { name: 'South American countries', clues: ['Brazil', 'Argentina', 'Peru', 'Chile', 'Colombia'] },
  { name: 'US states', clues: ['Texas', 'Florida', 'Ohio', 'Nevada', 'Maine'] },
  { name: 'Great Lakes', clues: ['Superior', 'Michigan', 'Huron', 'Erie', 'Ontario'] },
  { name: 'Mountain ranges', clues: ['Alps', 'Andes', 'Himalayas', 'Rockies', 'Urals'] },
  { name: 'Long rivers', clues: ['Nile', 'Amazon', 'Yangtze', 'Mississippi', 'Danube'] },
  { name: 'Deserts', clues: ['Sahara', 'Gobi', 'Mojave', 'Kalahari', 'Atacama'] },
  { name: 'Weather phenomena', clues: ['Hurricane', 'Tornado', 'Blizzard', 'Thunderstorm', 'Drought'] },
  { name: 'Cloud types', clues: ['Cumulus', 'Cirrus', 'Stratus', 'Nimbus', 'Cumulonimbus'] },
  { name: 'Gemstones', clues: ['Diamond', 'Ruby', 'Emerald', 'Sapphire', 'Opal'] },
  { name: 'Vitamins', clues: ['Vitamin A', 'Vitamin C', 'Vitamin D', 'Vitamin E', 'Vitamin K'] },
  { name: 'Human senses', clues: ['Sight', 'Hearing', 'Smell', 'Taste', 'Touch'] },
  { name: 'Body organs', clues: ['Heart', 'Liver', 'Lungs', 'Kidney', 'Brain'] },
  { name: 'Blood types', clues: ['A positive', 'B negative', 'O positive', 'AB positive', 'O negative'] },
  { name: 'States of matter', clues: ['Solid', 'Liquid', 'Gas', 'Plasma', 'Vapor'] },
  { name: 'Branches of science', clues: ['Physics', 'Chemistry', 'Biology', 'Geology', 'Astronomy'] },
  { name: 'Math operations', clues: ['Addition', 'Subtraction', 'Multiplication', 'Division', 'Exponent'] },
  { name: 'Geometry terms', clues: ['Angle', 'Radius', 'Vertex', 'Diameter', 'Perimeter'] },
  { name: 'Units of length', clues: ['Meter', 'Mile', 'Inch', 'Foot', 'Kilometer'] },
  { name: 'Units of time', clues: ['Second', 'Minute', 'Hour', 'Decade', 'Century'] },
  { name: 'Vegetables', clues: ['Carrot', 'Broccoli', 'Spinach', 'Potato', 'Cabbage'] },
  { name: 'Spices', clues: ['Cinnamon', 'Cumin', 'Paprika', 'Turmeric', 'Nutmeg'] },
  { name: 'Herbs', clues: ['Basil', 'Mint', 'Thyme', 'Rosemary', 'Parsley'] },
  { name: 'Nuts', clues: ['Almond', 'Walnut', 'Cashew', 'Pistachio', 'Hazelnut'] },
  { name: 'Cheeses', clues: ['Cheddar', 'Brie', 'Gouda', 'Mozzarella', 'Parmesan'] },
  { name: 'Cocktails', clues: ['Martini', 'Mojito', 'Margarita', 'Negroni', 'Daiquiri'] },
  { name: 'Dance styles', clues: ['Ballet', 'Salsa', 'Tango', 'Waltz', 'Hip-hop'] },
  { name: 'Film genres', clues: ['Comedy', 'Horror', 'Thriller', 'Romance', 'Western'] },
  { name: 'Poetry forms', clues: ['Haiku', 'Sonnet', 'Limerick', 'Ode', 'Ballad'] },
  { name: 'Fairy tales', clues: ['Cinderella', 'Rapunzel', 'Pinocchio', 'Rumpelstiltskin', 'Thumbelina'] },
  { name: 'Norse mythology', clues: ['Odin', 'Thor', 'Loki', 'Freya', 'Valhalla'] },
  { name: 'Egyptian gods', clues: ['Ra', 'Anubis', 'Osiris', 'Isis', 'Horus'] },
  { name: 'Famous scientists', clues: ['Einstein', 'Newton', 'Darwin', 'Curie', 'Tesla'] },
  { name: 'Renewable energy', clues: ['Solar', 'Wind', 'Hydro', 'Geothermal', 'Biomass'] },
  { name: 'Currencies', clues: ['Dollar', 'Euro', 'Yen', 'Pound', 'Rupee'] },
  { name: 'Languages', clues: ['Spanish', 'Mandarin', 'Arabic', 'French', 'Hindi'] },
  { name: 'Types of triangle', clues: ['Equilateral', 'Isosceles', 'Scalene', 'Right', 'Obtuse'] },
  { name: 'Olympic medals & places', clues: ['Gold', 'Silver', 'Bronze', 'Podium', 'Torch'] },
  { name: 'Solar system moons', clues: ['Luna', 'Titan', 'Europa', 'Io', 'Ganymede'] },
  { name: 'Constellations', clues: ['Orion', 'Cassiopeia', 'Ursa Major', 'Scorpius', 'Andromeda'] },
  { name: 'Trees', clues: ['Oak', 'Maple', 'Pine', 'Birch', 'Willow'] },
  { name: 'Flowers', clues: ['Rose', 'Tulip', 'Daisy', 'Orchid', 'Sunflower'] },
]

function shuffle(arr, rng = Math.random) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export class PinpointEngine {
  constructor({ count = 5, rng = Math.random } = {}) {
    this.count = count
    this.rounds = PinpointEngine.generate(count, rng)
  }

  get total() { return this.count }

  // `count` DISTINCT categories per game, each turned into a playable round.
  static generate(count, rng = Math.random) {
    const pool = shuffle(CATEGORIES, rng)
    const rounds = []
    for (let i = 0; i < count; i++) rounds.push(PinpointEngine.makeRound(pool[i % pool.length], rng))
    return rounds
  }

  // One round: the five clues (revealed order shuffled) + four options
  // (the answer category name + three random decoy category names).
  static makeRound(cat, rng = Math.random) {
    const decoys = shuffle(CATEGORIES.filter(c => c.name !== cat.name), rng).slice(0, 3).map(c => c.name)
    const options = shuffle([cat.name, ...decoys], rng)
    const clues = shuffle(cat.clues, rng).slice(0, 5)
    return { clues, options, answer: cat.name }
  }

  // Client-safe view: only the clues revealed SO FAR, plus the options. Never the answer.
  publicRound(i, revealed = 1) {
    const r = this.rounds[i]
    if (!r) return null
    return {
      index: i,
      clues: r.clues.slice(0, Math.max(0, Math.min(revealed, r.clues.length))),
      options: r.options,
      revealed,
      total: this.count,
    }
  }

  getState() {
    return { round: this.publicRound(0, 1), total: this.count }
  }

  // Validate a category choice for a given round index.
  check(index, choice) {
    const r = this.rounds[index]
    if (!r) return { valid: false, error: 'No such round' }
    return { valid: true, correct: String(choice) === r.answer, answer: r.answer }
  }

  // Points for a correct answer given how many clues were showing (fewer = more):
  // 1 clue → 5, 2 → 4, … 5 → 1.
  static pointsFor(revealed) {
    return Math.max(1, 6 - revealed)
  }
}
