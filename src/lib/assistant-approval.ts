const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[.!]+$/,'').trim();
/** Only an explicit approval applies the last visible proposal; questions never do. */
export function approvesAssistantProposal(text:string){
 return /^(?:(?:sim|ok|certo|beleza),?\s+)?(?:pode (?:aplicar|preencher|colocar|atualizar|publicar|programar)|aplique|aplicar|confirmo|autorizo)(?: (?:isso|a sugestao|essa sugestao|as alteracoes|essas alteracoes|os campos|o texto|no texto|nos campos|no formulario))?$/.test(normalize(text));
}
/** Compound instructions always generate a fresh proposal, preserving language and other qualifiers. */
export function requestsAssistantFieldApplication(text:string){
 const value=normalize(text);
 const intent=value.replace(/\b(?:nao|sem)\s+(?:salv\w*|grav\w*)[^.!;]*/g,'');
 if(/[?¿]|\b(?:nao|nunca|depois|talvez|caso|quando|antes|mas|porem|exceto|se)\b/.test(intent))return false;
 // A quoted command or a report of a past request is not a new authorization.
 if(/["“”]|\b(?:disse|pedi|falou|respondeu|mensagem|exemplo)\b/.test(intent))return false;
 return /(?:^|[,.!;]\s*|\b(?:e|entao|agora|ja)\s+)(?:(?:sim|ok|certo|beleza),?\s+)?(?:(?:ja\s+)?pode (?:aplicar|preencher|colocar|atualizar|salvar)|aplique|preencha|atualize|salve)\b/.test(intent);
}
/** An explicit draft-only request is respected even inside an existing record. */
export function assistantApplicationMayPersist(text:string){
 return !/\b(?:sem|nao)\s+(?:salv\w*|grav\w*)|\b(?:so|somente|apenas)\s+(?:no |o )?rascunho\b/.test(normalize(text));
}
/** A model prepares a proposal; only the client knows whether fields actually changed. */
export function pendingAssistantProposalReply(reply:string){
 return /\b(?:apliquei|salvei|publiquei|atualizei|preenchi|deixei|foi aplicado|foram aplicad|campos (?:ja )?estao)\b/.test(normalize(reply))
  ? 'Preparei a sugestão abaixo. Ela ainda não foi aplicada; confira e autorize para alterar os campos.' : reply;
}
export function requestsTechnicalReview(message:string,label:string){
 return /relato|tecnic|ocorrencia/i.test(normalize(label))&&/tudo (?:certo|correto|ok)|(?:esta|ta) (?:certo|correto|bom)|revis|referencia|valid|adequad|bem descrit|linguagem tecnic/.test(normalize(message));
}
export const technicalReviewPolicy='REVISÃO DO RELATO: avalie separadamente clareza da redação, completude da observação e fundamentação documental. Uma descrição curta não prova completude nem correção técnica. Para "Altímetro / intermitente em voo", proponha "Indicação intermitente do altímetro durante o voo", preservando somente os fatos; pergunte qual indicação/instrumento e como a intermitência se manifesta, uma pergunta por vez. Não atribua causa, diagnóstico ou teste. Consulte a biblioteca para a referência pertinente e cite de forma curta documento/seção SOMENTE quando encontrado e aplicabilidade demonstrada. Um documento público genérico não é o AMM/FIM aprovado nem valida este relato. Se faltar referência aplicável, diga isso diretamente e peça a referência/documento do operador; jamais preencha AMM/FIM/página por memória. A observação pode ser registrada mesmo sem referência; não a trate como procedimento executado. Não aprove tecnicamente apenas porque a ortografia está correta. Uma revisão sem autorização deve apresentar a sugestão e aguardar autorização. Se o pedido já incluir aplicar, atualizar ou salvar, prepare as correções solicitadas sem pedir autorização novamente. ATA pode ser sugerido como classificação geral do sistema, quando houver fundamento e o usuário solicitar; isso não comprova um procedimento ou referência específica de AMM/FIM. Não invente tarefa, revisão, efetividade ou data de consulta. Não use preparar_campos para certificar conformidade.';
