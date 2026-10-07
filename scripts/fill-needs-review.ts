/**
 * Fills Catalog Requests → Needs review books only.
 * Does not create genres. Does not change catalogReviewStatus.
 *
 *   pnpm tsx scripts/fill-needs-review.ts --dry-run
 *   pnpm tsx scripts/fill-needs-review.ts
 */

import {randomUUID} from 'node:crypto'
import {config} from 'dotenv'
import {createClient} from '@sanity/client'

config({path: ['.env.local', '.env'], quiet: true})

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
const TOKEN = process.env.SANITY_API_WRITE_TOKEN
const GOOGLE_KEY = process.env.GOOGLE_BOOKS_API_KEY
const DRY_RUN = process.argv.includes('--dry-run')

if (!PROJECT_ID) throw new Error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID')
if (!TOKEN) throw new Error('Missing SANITY_API_WRITE_TOKEN')

const sanity = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: '2026-09-01',
  token: TOKEN,
  useCdn: false,
})

type NeedsBook = {
  _id: string
  title: string
  authors?: string[] | null
  isbn13?: string | null
  publisher?: string | null
  publishedDate?: string | null
  pageCount?: number | null
}

type Fill = {
  description: string
  genres: [string, string, string]
  isbn13?: string
  publisher?: string
  publishedDate?: string
  pageCount?: number
}

function key() {
  return randomUUID().replace(/-/g, '').slice(0, 12)
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function authorLine(authors?: string[] | null) {
  return (authors ?? []).map((name) => name.replace(/\s+/g, ' ').trim()).filter(Boolean).join(', ')
}

function altText(title: string, authors?: string[] | null) {
  const author = authorLine(authors) || 'Unknown author'
  return `${title.trim()} by ${author}`
}

function isbn13Of(identifiers?: {type?: string; identifier?: string}[]) {
  const isbn13 = identifiers?.find((id) => id.type === 'ISBN_13' && /^\d{13}$/.test(id.identifier || ''))
  return isbn13?.identifier
}

async function lookupOpenLibrary(title: string, author: string) {
  const params = new URLSearchParams({
    title: title.replace(/\s*\([^)]*\)\s*$/, ''),
    author,
    limit: '5',
  })
  const response = await fetch(`https://openlibrary.org/search.json?${params}`, {
    headers: {'User-Agent': 'EverlogueCatalogFill/1.0 (https://everlogue.app)'},
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) return null
  const data = await response.json() as {
    docs?: {
      title?: string
      isbn?: string[]
      publisher?: string[]
      publish_date?: string[]
      number_of_pages_median?: number
    }[]
  }
  const doc = data.docs?.[0]
  if (!doc) return null
  const isbn13 = doc.isbn?.find((value) => /^\d{13}$/.test(value))
  const publishedDate = doc.publish_date?.[0]?.replace(/[.,]/g, '').trim()
  let date = publishedDate
  if (publishedDate && /^\d{4}$/.test(publishedDate)) date = publishedDate
  else if (publishedDate) {
    const parsed = Date.parse(publishedDate)
    if (!Number.isNaN(parsed)) {
      const iso = new Date(parsed).toISOString().slice(0, 10)
      date = publishedDate.length <= 7 ? publishedDate : iso
    }
  }
  return {
    isbn13,
    publisher: doc.publisher?.[0],
    publishedDate: date,
    pageCount: doc.number_of_pages_median,
  }
}

async function lookupGoogle(title: string, author: string) {
  const query = author ? `intitle:${title} inauthor:${author}` : `intitle:${title}`
  const params = new URLSearchParams({q: query, maxResults: '5', printType: 'books'})
  if (GOOGLE_KEY) params.set('key', GOOGLE_KEY)
  const response = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`, {
    headers: GOOGLE_KEY ? {'x-goog-api-key': GOOGLE_KEY} : undefined,
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) return null
  const data = await response.json() as {
    items?: {
      volumeInfo?: {
        title?: string
        authors?: string[]
        publisher?: string
        publishedDate?: string
        pageCount?: number
        industryIdentifiers?: {type?: string; identifier?: string}[]
      }
    }[]
  }
  const wantedTitle = normalize(title)
  const wantedAuthor = normalize(author)
  const match = (data.items || []).find((item) => {
    const info = item.volumeInfo
    const titleOk = normalize(info?.title || '').includes(wantedTitle.slice(0, 24)) || wantedTitle.includes(normalize(info?.title || '').slice(0, 24))
    const authorOk = !wantedAuthor || (info?.authors || []).some((name) => normalize(name).includes(wantedAuthor.split(' ').pop() || ''))
    return titleOk && authorOk
  }) || data.items?.[0]
  const info = match?.volumeInfo
  if (!info) return null
  return {
    isbn13: isbn13Of(info.industryIdentifiers),
    publisher: info.publisher,
    publishedDate: info.publishedDate,
    pageCount: typeof info.pageCount === 'number' && info.pageCount > 0 ? info.pageCount : undefined,
  }
}

/** Original two-to-three sentence summaries. Genres must already exist in Studio. */
const FILL: Record<string, Fill> = {
  '162117a0-3edf-4563-8054-7c7448149d33': {
    description: 'A Maine teacher finds a portal to 1958 and becomes obsessed with stopping Lee Harvey Oswald. Living a second life in the past, he learns how violently history resists being rewritten.',
    genres: ['Science Fiction', 'Historical Fiction', 'Time Travel Fiction'],
  },
  '564ca2b4-3635-4d13-9364-96c557aaa4b6': {
    description: 'A narrative history of the 1929 crash follows bankers, politicians, and ordinary families through the weeks that shattered American prosperity. Sorkin shows how speculation, denial, and weak safeguards turned a market panic into a national disaster.',
    genres: ['History', 'Narrative Nonfiction', 'Current Affairs & History'],
  },
  'b096a617-bf42-4d98-8ab7-22e8371fa8ee': {
    description: 'In 1970s India, a Parsi widow and two tailors from the countryside share a cramped Bombay apartment. Their fragile household becomes a portrait of caste, poverty, and endurance under emergency rule.',
    genres: ['Literary Fiction', 'Historical Fiction', 'Family Saga'],
  },
  '64ae6ff5-0e19-4631-8010-9808e028879b': {
    description: 'A psychologist treating a teenage girl accused of murder recognizes details from her own sister’s unsolved killing. As the cases overlap, she can no longer tell whether she is hunting a killer or repeating an old trauma.',
    genres: ['Psychological Thriller', 'Crime Fiction', 'Mystery'],
  },
  'b265527d-f641-404d-8f95-3b31cdafaa7d': {
    description: 'Four college friends in New York build a life around one of them, whose suffering becomes the center of their devotion. The novel follows decades of love, dependence, and the moral cost of staying.',
    genres: ['Literary Fiction', 'LGBTQ+ Fiction', 'Friendship Fiction'],
  },
  '238339f1-b264-43d6-bc8e-03fe616ad31c': {
    description: 'A reckless young mage on the island of Gont unleashes a shadow he cannot name. His education on Roke and the chase that follows become a lesson in power, naming, and balance.',
    genres: ['Fantasy', 'High Fantasy', 'Coming-Of-Age'],
  },
  '1feda000-052f-4e02-9cfe-e9d4b720a59a': {
    description: 'A full life of Alexander Hamilton traces his rise from the Caribbean to the founding of American finance. Chernow follows ambition, scandal, and the rivalries that shaped the early republic.',
    genres: ['Biography', 'History', 'Narrative Nonfiction'],
  },
  '171ab0ff-f85a-4448-8717-5c936acfc404': {
    description: 'A married artist in Los Angeles tests the edges of desire, work, and family after a locked-room dance class. The novel treats midlife craving as both comic and costly.',
    genres: ['Literary Fiction', 'Contemporary Fiction', 'Satire'],
  },
  'book.google.53ec71902887341c067ef636': {
    description: 'In a decaying Missouri town, a boy named Patch searches for a missing girl and grows into a man still haunted by the case. The mystery stretches across decades of loyalty, violence, and unfinished love.',
    genres: ['Literary Mystery', 'Coming-Of-Age', 'Crime Fiction'],
    isbn13: '9781250759696',
    publisher: 'Henry Holt and Company',
    publishedDate: '2024-05-21',
  },
  'b221c22b-b986-4eb2-b7e1-dbfb9bf6b0f7': {
    description: 'Henry VIII’s fourth wife arrives from Cleves with a portrait that does not match the woman he meets. Weir follows Anna’s brief queenship and the political uses of her image.',
    genres: ['Historical Fiction', 'Biographical Fiction', 'Royal Fiction'],
  },
  '7fec8617-8240-4530-b052-9a33e4622731': {
    description: 'Anne Boleyn enters Henry VIII’s court determined not to become another discarded mistress. The novel tracks her rise, her religion, and the machinery that destroys her.',
    genres: ['Historical Fiction', 'Biographical Fiction', 'Royal Fiction'],
  },
  'c2209d94-7b41-4448-9605-b21c4377ebd7': {
    description: 'A Cantonese orphan is trained for Oxford’s Royal Institute of Translation, where silver-working magic powers the British Empire. Robin Swift must decide whether language can serve justice or only conquest.',
    genres: ['Historical Fantasy', 'Dark Academia', 'Literary Fantasy'],
  },
  '4740bc31-2e96-4463-a3be-3d307b971249': {
    description: 'A teenage runaway joins a scalp-hunting expedition along the Texas-Mexico border in the 1840s. McCarthy’s west is a theater of violence with almost no moral ground left to stand on.',
    genres: ['Literary Fiction', 'Western', 'Historical Fiction'],
  },
  'fe9ac9c1-3118-4a02-983b-f20659386f9e': {
    description: 'A Titan’s overlooked daughter discovers witchcraft and is exiled to a deserted island. Circe’s encounters with gods and mortals force her to choose whose world she belongs to.',
    genres: ['Mythic Retelling', 'Literary Fantasy', 'Historical Fantasy'],
  },
  '15cb960b-6aab-46cf-8061-07fb66bca768': {
    description: 'After James Garfield is shot, doctors, inventors, and a deluded assassin shape the weeks that follow. Millard braids medical history with the political fight over a wounded presidency.',
    genres: ['History', 'Biography', 'True Crime'],
  },
  'b32d8ba6-385e-4ecf-a742-cc40b05b5ed8': {
    description: 'A young woman working in a New England boys’ prison in the 1960s plans an escape from her abusive home. Eileen’s inner life is grim, funny, and increasingly unhinged.',
    genres: ['Literary Fiction', 'Psychological Fiction', 'Coming-Of-Age'],
  },
  'a456e414-1b56-44eb-baf6-1995f2116fd9': {
    description: 'A biography of Henry VII’s queen follows Elizabeth of York from civil war through the founding of the Tudor dynasty. Weir reconstructs a life often treated as a dynastic symbol rather than a person.',
    genres: ['Biography', 'History', 'Royalty'],
  },
  'jQhz7vx9ABWBZHdeUb4H8L': {
    description: 'An American dynamiter joins an antifascist guerrilla band in the Spanish Civil War and falls in love with a young woman in the mountains. Hemingway measures courage, loyalty, and the cost of a lost cause.',
    genres: ['Literary Fiction', 'War Fiction', 'Historical Fiction'],
    isbn13: '9780684803357',
    publisher: 'Scribner',
    publishedDate: '1995-07',
    pageCount: 471,
  },
  'eb391e71-684c-4b40-9467-7a426f7333ed': {
    description: 'Violet Sorrengail is conscripted into a brutal college for dragon riders she was never meant to join. Survival, rivalry, and a forbidden bond rewrite the war she thought she understood.',
    genres: ['Fantasy Romance', 'New Adult Fiction', 'Epic Fantasy'],
  },
  'fcaf9f07-e882-4da6-be47-0aa7bf28b3e8': {
    description: 'A swordswoman raised among skeletons is forced to serve as cavalier to a necromancer she hates. Their trial among the Houses mixes duels, politics, and undead scholarship.',
    genres: ['Science Fiction', 'Fantasy', 'LGBTQ+ Fiction'],
  },
  '77e83d20-2aa8-491f-902c-52a3fe052920': {
    description: 'On a delayed flight, a stranger predicts the ages at which fellow passengers will die. Years later those forecasts begin to come true, and the survivors cannot stop measuring their remaining time.',
    genres: ['Contemporary Fiction', 'Literary Fiction', 'Psychological Fiction'],
  },
  '43046d2e-5f10-43c7-98bf-d09445d7ca86': {
    description: 'A single mother drowns in a river town, and the women who knew her hold conflicting stories. The investigation drags up an older drowning and the lies a community tells about girls.',
    genres: ['Psychological Thriller', 'Mystery', 'Crime Fiction'],
  },
  'dfbe1b51-047d-437c-8d0d-bcc322ccdd24': {
    description: 'Lily Bloom builds a Boston life and falls for a man whose charm hides violence. Leaving him proves as complicated as loving him, especially once family history repeats.',
    genres: ['Contemporary Fiction', 'Romance', 'Domestic Fiction'],
  },
  '9cd06be1-be5c-4c00-b834-25304e81b169': {
    description: 'After the events that ended her first marriage, Lily tries to start over while Atlas remains in her orbit. The sequel asks what repair looks like when the past is still in the room.',
    genres: ['Contemporary Fiction', 'Romance', 'Relationship Fiction'],
  },
  'fdd8d619-72f8-4060-bbf7-076d5cae61ca': {
    description: 'An orphaned girl becomes a governess at Thornfield Hall and falls for her employer, whose house keeps a secret. Brontë’s novel is a study of independence, class, and a love that demands equality.',
    genres: ['Classic Fiction', 'Gothic Fiction', 'Romance'],
  },
  'ed3b3102-1a85-421d-b6a1-056d7fb8f3fe': {
    description: 'Jane Seymour waits at the edge of Henry VIII’s court as Anne Boleyn’s power collapses. Weir imagines a quiet queen caught between conscience, family, and a king who wants an heir.',
    genres: ['Historical Fiction', 'Biographical Fiction', 'Royal Fiction'],
  },
  'f5f25f11-c0df-470d-9744-d4cc452d65d2': {
    description: 'In an England where practical magic returns during the Napoleonic Wars, two magicians become collaborators and rivals. Their quarrel with the fairy realm rewrites the country’s sense of itself.',
    genres: ['Historical Fantasy', 'Literary Fantasy', 'Fantasy'],
  },
  'e895f7a9-1b4e-4733-bd7c-b1d988ff28b7': {
    description: 'Twice-widowed Katharine Parr marries Henry VIII and tries to keep her faith, her household, and her life intact. The last of Weir’s Tudor queens novels is about survival in a dying king’s court.',
    genres: ['Historical Fiction', 'Biographical Fiction', 'Royal Fiction'],
  },
  '8f5a1e46-87b8-433b-af7a-90200f5d262e': {
    description: 'A teenage Katheryn Howard is lifted into queenship with little protection and many enemies. Weir follows the speed with which desire, gossip, and faction can destroy a young woman at court.',
    genres: ['Historical Fiction', 'Biographical Fiction', 'Royal Fiction'],
  },
  '299ba8fc-e3bc-496d-b989-bdd069952573': {
    description: 'A quiet woman in a small town begins a dangerous affair with a man who treats darkness as a game. The romance is erotic, obsessive, and built on secrets neither of them should keep.',
    genres: ['Romance', 'Erotic Romance', 'Contemporary Romance'],
  },
  'b7e6fa76-da91-4d66-9262-4cd8fbd4142d': {
    description: 'A memoir of raising orphaned elephants in Kenya, and of a marriage spent in conservation work. Sheldrick writes about animals, loss, and the long labor of keeping wild lives alive.',
    genres: ['Memoir', 'Nature Writing', 'Biography'],
  },
  '309e7eb7-5c79-4052-a8d4-4a316629a7db': {
    description: 'A psychiatrist who survived Nazi camps argues that meaning, not comfort, is what makes suffering bearable. The book moves from camp testimony to a therapy built on purpose.',
    genres: ['Memoir', 'Psychology', 'Literary Nonfiction'],
  },
  'c03a2743-2a2d-4cae-a56b-9e99fb3f4dab': {
    description: 'A biography of Anne Boleyn’s sister reconstructs Mary’s years as a royal mistress and the later life history often erases. Weir separates rumor from the thinner documentary record.',
    genres: ['Biography', 'History', 'Royalty'],
  },
  'd9f0b7f6-a1ab-43e9-a939-3841e55ec1e0': {
    description: 'Bregman argues that talented people waste themselves on prestige work instead of hard moral problems. The book is a push toward ambition aimed at other people’s lives, not just a résumé.',
    genres: ['Self-Help', 'Social Science', 'Nonfiction'],
  },
  'c8f0a370-e47f-4a4e-9114-63e7eb134349': {
    description: 'A single June day in London follows Clarissa Dalloway as she prepares a party and Peter Walsh as he returns from abroad. Woolf makes memory, war, and a city’s noise occupy the same few hours.',
    genres: ['Literary Fiction', 'Classic Fiction', 'Modern Literature'],
  },
  'bdbe47cc-9459-4edc-b018-b91d3d671445': {
    description: 'On a remote Shetland island, a lighthouse and a visiting stranger unsettle a community that lives by weather and rumours. Pedersen’s novel is about isolation, friendship, and the stories islands tell themselves.',
    genres: ['Literary Fiction', 'Contemporary Fiction', 'Rural Fiction'],
  },
  '8cd91125-ebbf-4e36-b363-817ffe39aed8': {
    description: 'A man called Piranesi inhabits a vast house of statues and tides, keeping notes for a visitor known as the Other. The labyrinth’s beauty hides a crime and a world outside the halls.',
    genres: ['Literary Fantasy', 'Speculative Fiction', 'Mystery'],
  },
  '6fbc7512-76b9-4124-9f3f-0d3d7db1a6cd': {
    description: 'Rusty Sabich, now a judge, is drawn back into a murder case that implicates his family. Turow’s courtroom novel is about guilt that never quite matches the verdict.',
    genres: ['Legal Thriller', 'Crime Fiction', 'Mystery'],
  },
  '94d885e6-4c5a-405a-86d4-d8d78a5d799d': {
    description: 'An astronaut wakes alone on a tiny ship with two dead crewmates and no memory of the mission. Saving Earth from an extinction-level threat means relearning science, friendship, and his own name.',
    genres: ['Science Fiction', 'Science-Fiction Action & Adventure', 'Humor'],
  },
  '24434e8d-c807-4735-85a9-5e0930eb3d4e': {
    description: 'During the Wars of the Roses, England’s queens fight with limited formal power and enormous personal risk. Weir follows royal women through alliances, imprisonment, and the making of a new dynasty.',
    genres: ['History', 'Biography', 'Royalty'],
  },
  '612b5467-56ef-4aab-9269-c001f19fd112': {
    description: 'A policy argument for rebuilding the American dream around a secure floor and room to rise. Libby writes about work, wealth, and the institutions that either trap people or let them move.',
    genres: ['Political Nonfiction', 'Current Affairs & History', 'Nonfiction'],
  },
  'book.google.8326f4f0d6802892dac969f9': {
    description: 'Two girls become summer sisters on Martha’s Vineyard, then spend adulthood measuring what that friendship cost. Blume follows class, sex, and loyalty across decades of chosen family.',
    genres: ['Coming-Of-Age', 'Friendship Fiction', 'Contemporary Fiction'],
    isbn13: '9780385324052',
    publishedDate: '1998',
  },
  'd2ca2da0-1154-4357-890a-7233f783a286': {
    description: 'Lincoln staffs his cabinet with former rivals and uses their conflicting strengths to hold the Union together. Goodwin’s biography is as much about management and temperament as about the war.',
    genres: ['Biography', 'History', 'Political Nonfiction'],
  },
  '1f405590-8aa3-4c27-88cd-15f7a06db513': {
    description: 'A talented young woman in 1950s New York unravels after a magazine internship and a botched hospital stay. Plath’s novel is a sharp account of ambition colliding with a medical system that cannot hear her.',
    genres: ['Literary Fiction', 'Classic Fiction', 'Psychological Fiction'],
  },
  '41706d85-5fe4-4721-ada1-a76a5bdf5802': {
    description: 'A family-run slaughterhouse hides more than meat, and a detective digging into a disappearance finds the business is built on bodies. The thriller is bloody, local, and uninterested in polite crime.',
    genres: ['Thriller', 'Crime Fiction', 'Horror'],
  },
  '212436d5-e61c-439b-830f-4552849cb9c7': {
    description: 'A Holocaust survivor and psychologist recounts Auschwitz, the murder of her parents, and the work of choosing life afterward. Eger’s memoir is both testimony and a practice of agency.',
    genres: ['Memoir', 'Psychology', 'History'],
  },
  'c3d4e87a-4eec-4882-a874-100cfce5b8d8': {
    description: 'In a world of constant seismic catastrophe, an orogene mother searches for her missing daughter after her son is murdered. Jemisin’s Stillness makes the earth itself a weapon and a caste system.',
    genres: ['Fantasy', 'Science Fiction', 'Apocalyptic Fiction'],
  },
  '9a048d92-7cb4-43a2-8fc9-47eb60c170bb': {
    description: 'A journalist and a hacker investigate a decades-old disappearance that implicates Sweden’s most respectable families. Larsson’s pairing of Mikael Blomkvist and Lisbeth Salander is as much about power as about a locked-room mystery.',
    genres: ['Crime Fiction', 'Mystery', 'Thriller'],
  },
  '16f6f3ed-443c-4c2a-9cca-5648022db05f': {
    description: 'A half-goblin fourth son is summoned from exile to inherit an imperial throne after his father and brothers are killed. Untrained in court intrigue, Maia must rule without friends and without trusting the people who bow.',
    genres: ['Fantasy', 'Court Intrigue', 'Literary Fantasy'],
  },
  '7b7fbd6f-e9f1-46a8-92a0-4ee507051a59': {
    description: 'In a theocratic America, a woman renamed Offred is assigned to bear children for a commander’s household. Atwood’s novel is about language, surveillance, and the small rebellions that keep a person intact.',
    genres: ['Dystopian Fiction', 'Literary Fiction', 'Speculative Fiction'],
  },
  'ff3d8079-9f2e-4cb6-8563-918a2443fca0': {
    description: 'A history of the Boleyn family follows their climb through Tudor service, marriage, and catastrophe. Borman treats Anne’s kin as a household of ambition rather than a single tragic queen.',
    genres: ['History', 'Biography', 'Royalty'],
  },
  '3b3d391f-9f7c-4ac2-9afa-c5022a0d44aa': {
    description: 'In 1714 a young woman makes a bargain for a longer life and spends centuries being forgotten by everyone she meets. Addie’s curse becomes a study of memory, art, and what it costs to be unseen.',
    genres: ['Historical Fantasy', 'Literary Fantasy', 'Romance'],
  },
  '1864adac-2d25-4c3a-9a3c-ea2e2f1578ae': {
    description: 'A history of U.S.-backed mass violence in Indonesia and the Cold War programs that followed. Bevins argues that anticommunist crusades reshaped the Third World by making murder a method of policy.',
    genres: ['History', 'Political Nonfiction', 'Social Justice Nonfiction'],
  },
  '1b4c87c9-5b29-462a-b799-91102d441491': {
    description: 'A human envoy on the ice world of Winter must learn a culture whose people are neither male nor female most of the month. Le Guin’s thought experiment is also a survival story and a political education.',
    genres: ['Science Fiction', 'Literary Fiction', 'Political Fiction'],
  },
  '0f4cad28-de8d-4c3c-a109-cd8a71fe15d0': {
    description: 'A popular self-help argument for releasing other people’s opinions and reclaiming attention. Robbins writes in direct address about control, anxiety, and what happens when you stop managing everyone else.',
    genres: ['Self-Help', 'Psychology', 'Self-Improvement'],
  },
  '52c6beeb-8253-4cae-bf2f-1ca546190326': {
    description: 'Robert Langdon is summoned to Washington after a macabre invitation appears in the Capitol. The chase through Masonic history is Brown’s usual mix of codes, monuments, and a ticking plot.',
    genres: ['Thriller', 'Mystery', 'Adventure Fiction'],
  },
  'c5b1de46-fbce-4043-9796-1177e31a552d': {
    description: 'An innkeeper in a quiet town tells a scribe the story of his youth: a troupe, a city slum, and a dangerous university of magic. Kvothe’s legend and his present silence do not agree.',
    genres: ['Fantasy', 'High Fantasy', 'Coming-Of-Age'],
  },
  '447d9888-77a7-4cb5-ac9b-39a688753cde': {
    description: 'A circus that appears without warning becomes the arena for a duel between two young magicians. Their love is real, the game is lethal, and the tents are only the visible stage.',
    genres: ['Fantasy', 'Historical Fantasy', 'Romance'],
  },
  '4b0e0cd2-c955-46a2-ba48-96ace79eee4b': {
    description: 'A sequel that finds its couple after the first rush of falling in love, when memory and new trouble test what they promised. Jimenez writes reunion as work, not a curtain call.',
    genres: ['Contemporary Romance', 'Romance', 'Relationship Fiction'],
  },
  'ff19234b-2a1b-404d-9046-8542d762683c': {
    description: 'A wife plans the perfect murder of her husband, then discovers someone else may have gotten there first. The thriller turns a marriage into a contest of who can tell the more convincing story.',
    genres: ['Domestic Thriller', 'Crime Fiction', 'Psychological Thriller'],
  },
  '0f9ea0db-8af5-4f75-b1b4-58ad80b5d05d': {
    description: 'A beautiful young man stays young while his portrait records every cruelty he commits. Wilde’s novel is a fable about aestheticism, influence, and the wish to live without consequence.',
    genres: ['Classic Fiction', 'Gothic Fiction', 'Philosophical Fiction'],
  },
  'bdb3589d-53df-4b3a-b87a-c827ed8665dd': {
    description: 'A war orphan from the south tests into an elite military academy and discovers a god of fire answering her rage. Kuang’s first Poppy War novel is about empire, opium, and the cost of shamanic power.',
    genres: ['Historical Fantasy', 'Epic Fantasy', 'War Fiction'],
  },
  '202b8d98-d484-4bb3-abca-98d1b50d8dac': {
    description: 'An unwed queen must produce an heir while assassins close in, and a lady-in-waiting secretly protects her with forbidden magic. Across the sea, a dragonrider’s loyalty is tested as old enemies wake.',
    genres: ['Epic Fantasy', 'High Fantasy', 'Political Fiction'],
  },
  'f1854900-cd3d-47a6-82aa-7fe751cde806': {
    description: 'A communist spy in the South Vietnamese army tells his story in a confession that is also a performance. Nguyen’s narrator is loyal to no side for long, including himself.',
    genres: ['Literary Fiction', 'Historical Fiction', 'Political Fiction'],
  },
  '92589099-fdb8-40d1-85f2-d9a938fa0d42': {
    description: 'Fifteen years after The Handmaid’s Tale, three women inside Gilead record how the regime looks from power, collaboration, and resistance. Atwood returns to a theocracy that is starting to crack.',
    genres: ['Dystopian Fiction', 'Literary Fiction', 'Political Fiction'],
  },
  'c74f8b9d-5d79-4277-8038-dea16c50fdb3': {
    description: 'A reclusive novelist agrees to tell her life story to a biographer, then fills the telling with ghosts, twins, and a Yorkshire house. Setterfield’s gothic is about who owns a story once it is written down.',
    genres: ['Gothic Fiction', 'Literary Mystery', 'Historical Fiction'],
  },
  'a7df0876-b0b1-4b14-9bf6-2ae5e771c3e2': {
    description: 'A Christmas gathering turns into a sequence of murders patterned on a carol. Cordani’s mystery is festive only until the guest list starts shrinking.',
    genres: ['Mystery', 'Crime Fiction', 'Thriller'],
  },
  '55ce7795-95f3-4fa0-bc41-2834f9e8197d': {
    description: 'A caseworker for magical youth is sent to inspect an island orphanage rumored to be dangerous. He finds children, a mysterious caretaker, and a government that prefers fear to care.',
    genres: ['Fantasy', 'LGBTQ+ Fiction', 'Contemporary Fantasy'],
  },
  'b6376917-513a-4541-a6e3-a58f27d65804': {
    description: 'A history of the Culper Ring, the spy network that served Washington during the Revolution. Rose follows ordinary men and women who moved intelligence through occupied New York.',
    genres: ['History', 'Spy Fiction', 'Narrative Nonfiction'],
  },
  '0ac78631-dc40-4102-81e0-d2ed4e538d12': {
    description: 'A revision of Oz told from the Wicked Witch’s side, beginning in a land already divided by race, religion, and animals’ rights. Maguire’s Elphaba is political long before she is green mythology.',
    genres: ['Fantasy', 'Literary Retelling', 'Political Fiction'],
  },
  '14fffdc1-c15c-4b6a-b1d9-4dfea56dae0f': {
    description: 'On the Yorkshire moors, Catherine Earnshaw and Heathcliff form a bond that outlasts marriage, death, and the next generation. Brontë’s novel is a study of possession dressed as a ghost story.',
    genres: ['Classic Fiction', 'Gothic Fiction', 'Romance'],
  },
  '3d398228-3601-4dbf-bae6-68a24beb982a': {
    description: 'A biography of Catherine Howard follows the fifth wife of Henry VIII from a neglected girlhood to the scaffold. Russell writes against the easy story of a foolish teenager and toward the court that used her.',
    genres: ['Biography', 'History', 'Royalty'],
  },
}

const PENDING = `(!defined(catalogReviewStatus) || catalogReviewStatus == "needsReview")`

const FALLBACK_META: Record<string, {isbn13: string; publisher: string; publishedDate: string; pageCount: number}> = {
  '162117a0-3edf-4563-8054-7c7448149d33': {isbn13: '9781451627299', publisher: 'Scribner', publishedDate: '2011-11-08', pageCount: 849},
  '16f6f3ed-443c-4c2a-9cca-5648022db05f': {isbn13: '9780765326997', publisher: 'Tor Books', publishedDate: '2014-04-01', pageCount: 446},
  '1feda000-052f-4e02-9cfe-e9d4b720a59a': {isbn13: '9780143034759', publisher: 'Penguin Books', publishedDate: '2005-03-29', pageCount: 818},
  '238339f1-b264-43d6-bc8e-03fe616ad31c': {isbn13: '9780547773742', publisher: 'Houghton Mifflin Harcourt', publishedDate: '2012', pageCount: 183},
  '24434e8d-c807-4735-85a9-5e0930eb3d4e': {isbn13: '9781639368822', publisher: 'Pegasus Books', publishedDate: '2025-11-04', pageCount: 480},
  '299ba8fc-e3bc-496d-b989-bdd069952573': {isbn13: '9781728290478', publisher: 'Bloom Books', publishedDate: '2024-04-02', pageCount: 496},
  '309e7eb7-5c79-4052-a8d4-4a316629a7db': {isbn13: '9780807014271', publisher: 'Beacon Press', publishedDate: '2006-06-01', pageCount: 184},
  '3d398228-3601-4dbf-bae6-68a24beb982a': {isbn13: '9781501108631', publisher: 'Simon & Schuster', publishedDate: '2017-04-04', pageCount: 480},
  '52c6beeb-8253-4cae-bf2f-1ca546190326': {isbn13: '9780385504225', publisher: 'Doubleday', publishedDate: '2009-09-15', pageCount: 528},
  '564ca2b4-3635-4d13-9364-96c557aaa4b6': {isbn13: '9780593296967', publisher: 'Viking', publishedDate: '2025-10-14', pageCount: 592},
  '64ae6ff5-0e19-4631-8010-9808e028879b': {isbn13: '9781250803825', publisher: 'Minotaur Books', publishedDate: '2022-01-11', pageCount: 357},
  '6fbc7512-76b9-4124-9f3f-0d3d7db1a6cd': {isbn13: '9781538706367', publisher: 'Grand Central Publishing', publishedDate: '2025-01-14', pageCount: 544},
  '7b7fbd6f-e9f1-46a8-92a0-4ee507051a59': {isbn13: '9780385490818', publisher: 'Anchor Books', publishedDate: '1998-03-16', pageCount: 311},
  '8cd91125-ebbf-4e36-b363-817ffe39aed8': {isbn13: '9781635575637', publisher: 'Bloomsbury', publishedDate: '2020-09-15', pageCount: 272},
  '8f5a1e46-87b8-433b-af7a-90200f5d262e': {isbn13: '9781101966518', publisher: 'Ballantine Books', publishedDate: '2020-05-12', pageCount: 480},
  '9a048d92-7cb4-43a2-8fc9-47eb60c170bb': {isbn13: '9780307454546', publisher: 'Vintage Crime/Black Lizard', publishedDate: '2008-09-16', pageCount: 620},
  'b32d8ba6-385e-4ecf-a742-cc40b05b5ed8': {isbn13: '9780143128755', publisher: 'Penguin Books', publishedDate: '2016-08-16', pageCount: 272},
  'b7e6fa76-da91-4d66-9262-4cd8fbd4142d': {isbn13: '9780374284473', publisher: 'Farrar, Straus and Giroux', publishedDate: '2012-06-26', pageCount: 352},
  'bdb3589d-53df-4b3a-b87a-c827ed8665dd': {isbn13: '9780062662583', publisher: 'Harper Voyager', publishedDate: '2018-05-01', pageCount: 544},
  'bdbe47cc-9459-4edc-b018-b91d3d671445': {isbn13: '9780593802687', publisher: 'Knopf', publishedDate: '2025-01-28', pageCount: 272},
  'c03a2743-2a2d-4cae-a56b-9e99fb3f4dab': {isbn13: '9780345521354', publisher: 'Ballantine Books', publishedDate: '2012-09-04', pageCount: 400},
  'c2209d94-7b41-4448-9605-b21c4377ebd7': {isbn13: '9780063021426', publisher: 'Harper Voyager', publishedDate: '2022-08-23', pageCount: 545},
  'c8f0a370-e47f-4a4e-9114-63e7eb134349': {isbn13: '9780156030359', publisher: 'Harvest Books', publishedDate: '1990', pageCount: 194},
  'e895f7a9-1b4e-4733-bd7c-b1d988ff28b7': {isbn13: '9781101966631', publisher: 'Ballantine Books', publishedDate: '2021-05-11', pageCount: 544},
  'eb391e71-684c-4b40-9467-7a426f7333ed': {isbn13: '9781649374042', publisher: 'Red Tower Books', publishedDate: '2023-05-02', pageCount: 517},
  'f1854900-cd3d-47a6-82aa-7fe751cde806': {isbn13: '9780802123459', publisher: 'Grove Press', publishedDate: '2015-04-02', pageCount: 384},
  'fcaf9f07-e882-4da6-be47-0aa7bf28b3e8': {isbn13: '9781250313195', publisher: 'Tor.com', publishedDate: '2019-09-10', pageCount: 448},
  'fe9ac9c1-3118-4a02-983b-f20659386f9e': {isbn13: '9780316556347', publisher: 'Little, Brown and Company', publishedDate: '2018-04-10', pageCount: 400},
  'ff19234b-2a1b-404d-9046-8542d762683c': {isbn13: '9781728205557', publisher: 'Sourcebooks Landmark', publishedDate: '2020-07-13', pageCount: 320},
}

async function main() {
  const [books, genreRows] = await Promise.all([
    sanity.fetch<NeedsBook[]>(
      `*[_type == "book" && !(_id in path("drafts.**")) && ${PENDING}]{_id, title, authors, isbn13, publisher, publishedDate, pageCount}`,
    ),
    sanity.fetch<{_id: string; title: string}[]>(
      `*[_type == "genre" && !(_id in path("drafts.**")) && defined(title)]{_id, title}`,
    ),
  ])

  const genresByName = new Map(genreRows.map((genre) => [normalize(genre.title), genre]))
  const missingFill: string[] = []
  const missingGenres = new Set<string>()
  const missingMeta: string[] = []
  let patched = 0

  for (const book of books) {
    const fill = FILL[book._id]
    if (!fill) {
      missingFill.push(`${book._id} ${book.title}`)
      continue
    }

    const genreRefs = fill.genres.map((name) => {
      const genre = genresByName.get(normalize(name))
      if (!genre) {
        missingGenres.add(name)
        return null
      }
      return {_type: 'reference' as const, _ref: genre._id, _key: key()}
    })
    if (genreRefs.some((ref) => !ref) || genreRefs.length !== 3) continue

    let isbn13 = fill.isbn13 || book.isbn13 || undefined
    let publisher = fill.publisher || book.publisher || undefined
    let publishedDate = fill.publishedDate || book.publishedDate || undefined
    let pageCount = fill.pageCount || (book.pageCount && book.pageCount > 0 ? book.pageCount : undefined)

    if (!isbn13 || !publisher || !publishedDate || !pageCount) {
      const shortTitle = book.title.replace(/\s*\([^)]*\)\s*$/, '')
      const author = authorLine(book.authors).split(',')[0] || ''
      const looked = await lookupGoogle(shortTitle, author) || await lookupOpenLibrary(shortTitle, author)
      isbn13 ||= looked?.isbn13
      publisher ||= looked?.publisher
      publishedDate ||= looked?.publishedDate
      pageCount ||= looked?.pageCount
      await new Promise((resolve) => setTimeout(resolve, 250))
    }

    const fallback = FALLBACK_META[book._id]
    if (fallback) {
      isbn13 ||= fallback.isbn13
      publisher ||= fallback.publisher
      publishedDate ||= fallback.publishedDate
      pageCount ||= fallback.pageCount
    }

    if (!isbn13 || !publisher || !publishedDate || !pageCount) {
      missingMeta.push(`${book.title} — isbn:${isbn13 || '—'} pub:${publisher || '—'} date:${publishedDate || '—'} pages:${pageCount || '—'}`)
    }

    const patch: Record<string, unknown> = {
      description: fill.description,
      genres: genreRefs,
      'coverOverride.alt': altText(book.title, book.authors),
    }
    if (isbn13) patch.isbn13 = isbn13
    if (publisher) patch.publisher = publisher
    if (publishedDate) patch.publishedDate = publishedDate
    if (pageCount) patch.pageCount = pageCount

    console.log(`${DRY_RUN ? 'Would patch' : 'Patch'} ${book.title.trim()}`)
    if (!DRY_RUN) await sanity.patch(book._id).set(patch).commit({visibility: 'sync'})
    patched += 1
  }

  console.log(`Patched ${patched} of ${books.length} needs-review books on ${DATASET}`)
  if (missingFill.length) console.log('No fill row:\n' + missingFill.join('\n'))
  if (missingGenres.size) console.log('Unknown genres:\n' + [...missingGenres].join('\n'))
  if (missingMeta.length) console.log('Incomplete metadata:\n' + missingMeta.join('\n'))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
