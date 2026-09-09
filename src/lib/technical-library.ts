import "server-only";
import index from "@/data/technical-library-index.json";

type IndexedDocument = (typeof index.documents)[number];
type IndexedChunk = (typeof index.chunks)[number];

export type TechnicalLibraryResult = {
  documentId: string;
  title: string;
  documentNumber: string;
  issuer: string;
  section: string | null;
  model: string | null;
  ata: number[];
  page: number;
  sourceUrl: string;
  statusNote: string;
  library: string;
  excerpt: string;
  score: number;
};

const stopWords = new Set(["a","ao","aos","as","com","como","da","das","de","do","dos","e","em","foi","na","nas","no","nos","o","os","para","por","que","se","sem","um","uma","the","and","for","from","in","of","on","or","to","with"]);
const synonymGroups = [
  ["hsI","heading","proa","direcao","directional","ahrs","compass"],
  ["altimetro","altitude","altimeter","air data","pitot","static"],
  ["radioaltimetro","radio altimetro","radar altimeter","radio altimeter"],
  ["bailarina","prato oscilante","swashplate","uniball","trunnion"],
  ["caixa principal","caixa de transmissao","mgb","main gearbox","transmission"],
  ["oleo","oil","lubrificacao","lubrication","lube"],
  ["vazamento","leak","leakage","molhado","umido","umedecimento"],
  ["trinca","crack","fissura","indicacao linear"],
  ["risco","scratch","nick","arranhao","descontinuidade"],
  ["estabilizador","stabilizer","fitting","strut"],
  ["trem","landing gear","mlg","nlg"],
  ["combustivel","fuel","tanque","tank"],
  ["piloto automatico","autopilot","flight director","diretor de voo"],
  ["pfd","display","tela","flight display"],
  ["vhf","radio","comunicacao","communication"],
  ["gps","fms","navigation","navegacao","position"],
  ["corrosao","corrosion","fretting","desgaste","wear"],
];

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function termsFor(query: string) {
  const normalized = normalize(query);
  const direct = normalized.split(" ").filter(term => term.length > 2 && !stopWords.has(term));
  const expanded = new Set(direct);
  for (const group of synonymGroups) {
    if (group.some(term => normalized.includes(normalize(term)))) {
      group.flatMap(term => normalize(term).split(" ")).filter(term => term.length > 2).forEach(term => expanded.add(term));
    }
  }
  return {normalized,direct:[...new Set(direct)],expanded:[...expanded]};
}

function occurrenceScore(text: string, term: string) {
  let count = 0;
  let cursor = 0;
  while (count < 5 && (cursor = text.indexOf(term, cursor)) >= 0) {
    count += 1;
    cursor += term.length;
  }
  return count;
}

export function technicalLibraryStats() {
  return index.stats;
}

export function searchTechnicalLibrary(query: string, requestedLimit = 6): TechnicalLibraryResult[] {
  const terms = termsFor(query);
  if (!terms.direct.length) return [];
  const documents = new Map<string, IndexedDocument>(index.documents.map(document => [document.id, document]));
  const scored = (index.chunks as IndexedChunk[]).flatMap(chunk => {
    const document = documents.get(chunk.documentId);
    if (!document) return [];
    const text = normalize(chunk.text);
    const metadata = normalize(`${document.title} ${document.documentNumber} ${document.section ?? ""} ${document.model ?? ""} ${(document.ata ?? []).join(" ")}`);
    let score = terms.normalized.length > 4 && text.includes(terms.normalized) ? 30 : 0;
    for (const term of terms.expanded) score += occurrenceScore(text, term) * (terms.direct.includes(term) ? 5 : 1.5);
    for (const term of terms.direct) if (metadata.includes(term)) score += 8;
    if (document.library === "S-92A" && /s\s*92|sikorsky|mgb|swashplate|estabilizador|prato oscilante|caixa principal|trem|landing gear/i.test(query)) score += 8;
    if (score < Math.max(5, terms.direct.length * 2)) return [];
    return [{document,chunk,score}];
  }).sort((a,b) => b.score - a.score);

  const limit = Math.min(10, Math.max(1, requestedLimit));
  const results: TechnicalLibraryResult[] = [];
  const perDocument = new Map<string,number>();
  const pages = new Set<string>();
  for (const item of scored) {
    const pageKey = `${item.document.id}:${item.chunk.page}`;
    if (pages.has(pageKey) || (perDocument.get(item.document.id) ?? 0) >= 2) continue;
    pages.add(pageKey);
    perDocument.set(item.document.id,(perDocument.get(item.document.id) ?? 0) + 1);
    results.push({
      documentId:item.document.id,
      title:item.document.title,
      documentNumber:item.document.documentNumber,
      issuer:item.document.issuer,
      section:item.document.section,
      model:item.document.model,
      ata:item.document.ata,
      page:item.chunk.page,
      sourceUrl:item.document.sourceUrl,
      statusNote:item.document.statusNote,
      library:item.document.library,
      excerpt:item.chunk.text,
      score:Math.round(item.score * 10) / 10,
    });
    if (results.length >= limit) break;
  }
  return results;
}
