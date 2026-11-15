/**
 * The words Venus listens for, in Brazilian Portuguese.
 *
 * No imports on purpose: this is pure text, so `node --test` can load it
 * directly (test/ptbr.test.mjs).
 *
 * Word boundaries are Unicode lookarounds rather than `\b`, which in JavaScript
 * only knows ASCII letters: `\bnão\b` fails, because "ã" does not count as part
 * of the word. Accents are accepted in the patterns themselves, since the
 * transcriber may or may not write them.
 */

const B = '(?<![\\p{L}\\d])'
const E = '(?![\\p{L}\\d])'

/**
 * Her name. "Vênus" is a dictionary word in Portuguese (the planet), so the
 * transcriber gets it right far more often than it ever got "Jarvis"; the
 * variants cover the near misses. "vem nós" is left out on purpose — it is an
 * ordinary phrase, and a false wake on it would be constant.
 */
export const NAME = '(?:v[eéê]n[uo]s|vinus|b[eê]nus)'
/** Optional greeting before the name. */
export const PREFIX = '(?:oi|ei|ok|ol[aá]|hey|e a[ií])'

export const WAKE = new RegExp(`${B}(?:${PREFIX}[\\s,]*)?${NAME}${E}`, 'iu')

/** Everything after the wake phrase, which is usually the actual command. */
export function afterWake(text: string): string {
  const m = WAKE.exec(text)
  if (!m) return ''
  return text
    .slice(m.index + m[0].length)
    .replace(/^[\s,.:;!?-]+/, '')
    .trim()
}

/**
 * Short words that must always cut through, even when they collide with what
 * she happens to be saying. Bare "para" is left out: it is also the preposition
 * "for", and would turn half her own sentences into a stop.
 */
export const OVERRIDE = new RegExp(
  `${B}(?:pare|para com isso|para de falar|espera|${NAME}|cancela|cancelar|chega|sil[eê]ncio|quiet[oa]|cala a boca|esquece|deixa pra l[aá]|n[aã]o)${E}`,
  'iu',
)

/**
 * Ending on one of these means the sentence is not over, whatever the silence
 * says. Function words only — closed-class, so the list can be complete.
 * Tested against the last word alone.
 */
export const CONTINUES =
  /^(?:e|ou|mas|ent[aã]o|porque|pois|se|quando|que|de|do|da|dos|das|em|no|na|nos|nas|num|numa|por|pelo|pela|para|pra|pro|com|sem|sobre|at[eé]|o|a|os|as|um|uma|meu|minha|seu|sua|[eé]|s[aã]o|foi|era|est[aá]|est[aã]o|tem|como|mais|muito)$/iu

/** Lowercase, accents removed, punctuation gone — for comparing word bags. */
export const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Words too common to be evidence of anything when deciding whether the
 * microphone is hearing her own voice. Already in `norm` form (no accents).
 */
export const STOP = new Set(
  ('a o as os um uma uns umas e ou mas de do da dos das em no na nos nas por para pra pro ' +
    'com sem que se como quando onde quem qual quais porque eu voce ele ela nos eles elas ' +
    'me te lhe meu minha seu sua isso isto aquilo esse essa este esta ser estar e foi era ' +
    'tem ter tinha vai vou pode sim nao ja agora aqui ali la so muito mais bem entao ok').split(' '),
)
