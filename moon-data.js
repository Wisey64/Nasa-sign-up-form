/* ------------------------------------------------------------------
   All the text you see in "Explore the Moon" lives in this file.
   Edit it freely: add a mission, fix a sentence, change a fact.

   lat  = degrees north (+) or south (-)
   lon  = degrees east (+) or west (-)
   kind = "apollo" (amber pin) or "robot" (blue pin)

   Landing-site coordinates for the Apollo missions are NASA's, measured from
   Lunar Reconnaissance Orbiter photos (NASA NSSDC "Apollo Landing Site Coordinates").
------------------------------------------------------------------- */

export const SITES = [
  {
    id: "apollo11",
    kind: "apollo",
    short: "Apollo 11",
    name: "Apollo 11",
    tagline: "The first footsteps",
    date: "July 20, 1969",
    place: "Sea of Tranquility (Mare Tranquillitatis)",
    lat: 0.674,
    lon: 23.473,
    crew: "Neil Armstrong and Buzz Aldrin walked on the Moon. Michael Collins orbited above in Columbia.",
    story:
      "The lunar module Eagle touched down at Tranquility Base, and Neil Armstrong became the first person ever to stand on the Moon. Buzz Aldrin joined him about 19 minutes later. Together they spent roughly two and a half hours outside and collected about 21.5 kg of rock and soil.",
    fact:
      "They left a plaque, a flag and a mirror-like reflector. Scientists still bounce lasers off that reflector to measure the Moon's distance.",
  },
  {
    id: "apollo12",
    kind: "apollo",
    short: "Apollo 12",
    name: "Apollo 12",
    tagline: "A pinpoint landing",
    date: "November 19, 1969",
    place: "Ocean of Storms (Oceanus Procellarum)",
    lat: -3.013,
    lon: -23.422,
    crew: "Pete Conrad and Alan Bean walked on the Moon. Richard Gordon orbited above.",
    story:
      "The second crewed landing aimed at a spot right next to Surveyor 3, a robot probe that had landed in 1967. Conrad and Bean landed roughly 180 m away, walked over to it, and brought pieces home so engineers could see how it had aged on the Moon.",
    fact:
      "Their TV camera was accidentally pointed at the Sun and burned out, so there was no live video from the surface.",
  },
  {
    id: "apollo14",
    kind: "apollo",
    short: "Apollo 14",
    name: "Apollo 14",
    tagline: "The hills of Fra Mauro",
    date: "February 5, 1971",
    place: "Fra Mauro highlands",
    lat: -3.645,
    lon: -17.471,
    crew: "Alan Shepard and Edgar Mitchell walked on the Moon. Stuart Roosa orbited above.",
    story:
      "Apollo 14 went to Fra Mauro, the hilly region that Apollo 13 was supposed to explore before its famous emergency. Shepard, the first American in space, led the crew as they pulled a small hand cart of tools and samples across the rough ground.",
    fact: "Shepard brought a golf club head along and hit two golf balls on the Moon.",
  },
  {
    id: "apollo15",
    kind: "apollo",
    short: "Apollo 15",
    name: "Apollo 15",
    tagline: "The first Moon buggy",
    date: "July 30, 1971",
    place: "Hadley Rille and the Apennine Mountains",
    lat: 26.132,
    lon: 3.633,
    crew: "David Scott and James Irwin walked on the Moon. Alfred Worden orbited above.",
    story:
      "This was the first mission to bring a Lunar Roving Vehicle, a battery-powered buggy. It let the crew drive about 28 km in total and explore Hadley Rille, a long winding channel carved by ancient lava, right beside tall mountains.",
    fact:
      "Scott dropped a hammer and a feather at the same time. With no air to slow the feather, both hit the ground together.",
  },
  {
    id: "apollo16",
    kind: "apollo",
    short: "Apollo 16",
    name: "Apollo 16",
    tagline: "Into the highlands",
    date: "April 21, 1972 (UTC)",
    place: "Descartes Highlands",
    lat: -8.973,
    lon: 15.501,
    crew: "John Young and Charles Duke walked on the Moon. Ken Mattingly orbited above.",
    story:
      "Apollo 16 explored the Moon's rugged central highlands, the bright, old, crater-packed parts of the surface. Young and Duke drove their rover across the Descartes region and returned with about 95 kg of samples.",
    fact: "Charles Duke left a photo of his family on the surface.",
  },
  {
    id: "apollo17",
    kind: "apollo",
    short: "Apollo 17",
    name: "Apollo 17",
    tagline: "The last visit",
    date: "December 11, 1972",
    place: "Taurus-Littrow valley",
    lat: 20.191,
    lon: 30.772,
    crew: "Eugene Cernan and Harrison (Jack) Schmitt walked on the Moon. Ronald Evans orbited above.",
    story:
      "The final Apollo landing. Schmitt was a professional geologist, the only scientist to walk on the Moon. The crew stayed about three days, made the longest moonwalks of the program, and brought back around 110 kg of samples.",
    fact:
      "Cernan was the last person to leave the lunar surface. Twelve people have walked on the Moon, and nobody has since.",
  },
  {
    id: "luna9",
    kind: "robot",
    short: "Luna 9",
    name: "Luna 9",
    tagline: "The first soft landing",
    date: "February 3, 1966",
    place: "Ocean of Storms (Oceanus Procellarum)",
    lat: 7.13,
    lon: -64.37,
    crew: "Robotic spacecraft from the Soviet Union.",
    story:
      "Luna 9 was the first spacecraft to land gently on the Moon and send pictures back from the surface. Its photos showed that the ground was firm enough to hold up a lander, which was a big relief for the people planning Apollo.",
    fact: "It worked for only about three days before its batteries ran out.",
  },
  {
    id: "change4",
    kind: "robot",
    short: "Chang'e 4",
    name: "Chang'e 4",
    tagline: "The first landing on the far side",
    date: "January 3, 2019",
    place: "Von Kármán crater, inside the South Pole-Aitken basin (far side)",
    lat: -45.5,
    lon: 177.6,
    crew: "Robotic lander and Yutu-2 rover from China.",
    story:
      "The far side of the Moon never faces Earth, so Chang'e 4 was the first spacecraft ever to land there. It touched down in Von Kármán crater, part of a huge ancient impact basin about 2,500 km wide.",
    fact:
      "Radio signals can't pass through the Moon, so the lander talked to Earth through a relay satellite called Queqiao.",
  },
  {
    id: "chandrayaan3",
    kind: "robot",
    short: "Chandrayaan-3",
    name: "Chandrayaan-3",
    tagline: "India lands near the south pole",
    date: "August 23, 2023",
    place: "Statio Shiv Shakti, Moon's south polar region",
    lat: -69.37,
    lon: 32.32,
    crew: "Robotic lander Vikram and rover Pragyan from India.",
    story:
      "India became the fourth country to make a soft landing on the Moon. The lander touched down in the south polar region, where some craters never see sunlight and may hold ice, and its rover measured what the soil is made of.",
    fact: "The landing spot was officially named Statio Shiv Shakti in 2024.",
  },
];

export const FACTS = [
  { label: "Size", text: "About 3,475 km across, roughly a quarter of Earth's width." },
  { label: "Distance", text: "384,400 km from Earth on average. It drifts about 3.8 cm farther away every year." },
  { label: "Gravity", text: "About one-sixth of Earth's, so you would weigh about six times less." },
  { label: "Temperature", text: "From about -173 \u00B0C at night to about 127 \u00B0C in full sunlight." },
  { label: "Same face", text: "The Moon spins once for every trip around Earth (about 27.3 days), so the same side always faces us." },
  { label: "Far side", text: "It is not really \"dark\". It gets just as much sunlight as the side we see, we just never see it from Earth." },
  { label: "Dark patches", text: "These are called maria (Latin for \"seas\"). They are huge plains of ancient volcanic rock, not water." },
  { label: "Air", text: "Almost none, just an extremely thin layer of gas. That is why the sky there is black, even in the daytime." },
  { label: "Age", text: "About 4.5 billion years old. Most scientists think it formed when a Mars-sized object hit the young Earth." },
  { label: "Visitors", text: "Twelve people have walked on the Moon, all on the six Apollo landings between 1969 and 1972." },
];
