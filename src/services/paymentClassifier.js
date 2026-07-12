export const hasRentLink = (payment = {}) => Boolean(
  payment.receivable_id
  || payment.contract_id
  || payment.kitnet_id
  || payment.tenant_id
  || payment.competence
);

export const rentPaymentsOnly = (payments = []) => payments.filter(hasRentLink);

