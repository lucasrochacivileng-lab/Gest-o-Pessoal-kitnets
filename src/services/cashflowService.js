import { buildSegmentConsolidation } from './segmentConsolidationService.js';
import { isPersonalExpense } from './personalMovementClassifier.js';
import { isConfirmed } from './financialClassification.js';
import { addMoney, sumMoney } from './money.js';
export const PERSONAL_CONTEXTS = { PESSOAL:'pessoal',KITNETS:'kitnets',OBRA:'obra' };
export const buildCashflow = ({ payments=[],expenses=[],personal=[],projects=[],expertReports=[],monthKey }) => {
  const investedInBusiness = sumMoney(personal.filter(r=>isPersonalExpense(r)&&isConfirmed(r)&&['kitnets','obra'].includes(r.context)).map(r=>r.value));
  const pendingCardReview = personal.filter(r=>r.active!==false&&r.type==='card_transaction'&&['revisar','sugerido'].includes(r.status)).length;
  const summary = buildSegmentConsolidation({ payments, expenses, personal, projects, expertReports, monthKey });
  const segment = key => summary.segments.find(r=>r.key===key);
  return {
    kitnetsIn: segment('kitnets').income, kitnetsOut: segment('kitnets').expense, kitnetsResult: segment('kitnets').result,
    personalIn: addMoney(segment('pessoal').income,segment('trabalho').income),
    personalOut: addMoney(segment('pessoal').expense,segment('trabalho').expense),
    personalResult: addMoney(segment('pessoal').result,segment('trabalho').result),
    extraIn: addMoney(segment('projetos').income,segment('pericias').income),
    finalResult: summary.global.result, investedInBusiness, pendingCardReview,
  };
};
export default buildCashflow;
