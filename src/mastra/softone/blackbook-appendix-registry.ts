export type SoftOneBlackBookAppendixRegistry =
  | "SODTYPE"
  | "SOSOURCE"
  | "ORIGIN"
  | "CSTTYPE";


export interface SoftOneBlackBookAppendixEntry {
  registry:
    SoftOneBlackBookAppendixRegistry;

  code: string;

  label: string;

  page: number;

  section: string;
}


const SOURCE_SECTION_PREFIX =
  "Appendix – System Parameters & Commands";


export const SOFTONE_BLACKBOOK_APPENDIX_ENTRIES:
  readonly SoftOneBlackBookAppendixEntry[] = [
  /*
   * A. SODTYPE – Entity Values
   * BlackBook v3.5 p.542
   */
  ...[
    ["10", "Internal use only"],
    ["11", "Company"],
    ["12", "Suppliers"],
    ["13", "Customers"],
    ["14", "Cash accounts"],
    ["15", "Debtors"],
    ["16", "Creditors"],
    ["20", "Company employees"],
    ["21", "Contacts"],
    ["22", "Draft Entry"],
    ["25", "Resources"],
    ["28", "CRM Questionnaires"],
    ["29", "HR Questionnaires"],
    ["30", "Salespersons"],
    ["31", "Collectors"],
    ["32", "Buyers"],
    ["33", "Technicians"],
    ["40", "Projects"],
    ["41", "Installations"],
    ["42", "Special contracts"],
    ["43", "Geographic points"],
    ["44", "Warranties"],
    ["51", "Inventory"],
    ["52", "Services"],
    ["53", "Debits/Credits"],
    ["54", "Fixed assets"],
    ["61", "Revenue/Expense accounts"],
    ["70", "Item sets"],
    ["71", "Bills of materials"],
    ["72", "Debits/Credits set"],
    ["73", "Service sets"],
    ["81", "Cheques"],
    ["82", "Costing"],
    ["83", "Gift vouchers"],
    ["84", "Bonus cards"],
    ["89", "General ledger"],
    ["90", "Cost accounting"],
    ["91", "ABCosting"],
    ["95", "Payroll"],
    ["96", "Actions"],
    ["97", "Call centers"],
    ["98", "B2B service"],
  ].map(
    ([code, label]) => ({
      registry:
        "SODTYPE" as const,

      code,

      label,

      page:
        542,

      section:
        `${SOURCE_SECTION_PREFIX} / A. SODTYPE – Entity Values`,
    }),
  ),


  /*
   * B. SOSOURCE – Module Values
   * BlackBook v3.5 p.543
   */
  ...[
    ["1010-1019", "Custom business documents"],
    ["1054", "Depreciation documents"],
    ["1089", "G.L. entries"],
    ["1090", "C.A. entries"],
    ["1096", "Alternative packages"],
    ["1097", "Cash registers"],
    ["1098", "Financial status report (Bulgaria)"],
    ["1099", "KEPYO"],
    ["1100", "Accountants info documents"],
    ["1120", "Time sheets"],
    ["11351", "Retail"],
    ["1140", "Construction accounting codes"],
    ["1151", "Inventory documents"],
    ["1154", "Fixed asset documents"],
    ["1171", "Production orders"],
    ["1181", "Cheque documents"],
    ["1212", "Supplier reconciliation"],
    ["1251", "Purchase documents"],
    ["1253", "Special transactions - Suppliers"],
    ["1261", "Expense documents"],
    ["1281", "Cash transactions - Suppliers"],
    ["1282", "Imports costing"],
    ["1312", "Reconcile customer with suppliers"],
    ["1313", "Customers reconciliation"],
    ["1351", "Sales Documents"],

    ["1352", "Service folders"],
    ["1353", "Special transactions - Customers"],
    ["1361", "Revenue documents"],
    ["1381", "Cash transactions - Customers"],
    ["1382", "Exports costing"],
    ["1412", "Supplier remittances"],
    ["1413", "Customer remittances"],
    ["1414", "Cash accounts remittances"],
    ["1415", "Debtor remittances"],
    ["1416", "Creditor remittances"],
    ["1453", "Cash accounts special"],
    ["1481", "Cash account cash transactions"],
    ["1553", "Special from debtors"],
    ["1581", "Cash transactions from debtors"],
    ["1653", "Special from creditors"],
    ["1681", "Cash transactions from creditors"],
    ["1717", "Suppliers reconciliation"],
    ["2021", "Actions"],
    ["2052", "Service calls"],
    ["2095", "Payroll results"],
    ["5151", "Inventory composition"],
    ["5171", "Production order"],
    ["7151", "Production documents"],
    ["8100", "Cheques"],
    ["9500", "D.P.S."],
  ].map(
    ([code, label]) => ({
      registry:
        "SOSOURCE" as const,

      code,

      label,

      page:
        543,

      section:
        `${SOURCE_SECTION_PREFIX} / B. SOSOURCE – Module Values`,
    }),
  ),


  /*
   * C. ORIGIN – Transaction Source Values
   * BlackBook v3.5 p.544
   */
  ...[
    ["1", "Normal"],
    ["2", "Costing Imports"],
    ["3", "Costing Exports"],
    ["4", "Integrated financial & cost accounts"],
    ["5", "Automatic pay-off"],
    ["6", "Reversal transactions"],
    ["7", "Physical stock taking"],
    ["8", "From receiving note (Service)"],
    ["9", "From folder (Service)"],
    ["10", "Initialize fixed assets"],
    ["11", "From call (Service)"],
    ["12", "Update physical stock taking documents"],
    ["14", "Production documents from order-prod.orders"],
    ["15", "Composition doc. from sale/purchase/inventory"],
    ["16", "Revenue/Expenses"],
    ["17", "Credit notes due to turnover"],
    ["18", "Production orders from sales order"],
    ["19", "Semi-finished products production doc."],
    ["20", "Production document from work slips"],
    ["21", "From import"],
    ["22", "Production documents from subcontract"],
    ["23", "From cash register"],
    ["24", "Exchange rate gains and losses (evaluation)"],
    ["25", "Exchange rate gains and losses (open-item)"],
    ["26", "Previous fiscal years revenue"],
    ["27", "Inter-co. movement (from production)"],
    ["28", "Counter-balance account based costing"],
    ["29", "Card installment payment document"],
    ["30", "Forecast / Reversing document"],
    ["31", "Fixed assets revaluation"],
    ["32", "Opportunity interest"],
    ["33", "Contract document"],
    ["34", "Production slips from orders"],
    ["35", "Bonus points from bonus cards"],
    ["36", "Export document (Ifaistos)"],
    ["37", "Reversing of sales cost (Cyprus)"],
    ["38", "Credit note due to turnover (purchases)"],
    ["39", "VAT Records (Art. 39b)"],
    ["40", "Contract Instalment Invoices"],
  ].map(
    ([code, label]) => ({
      registry:
        "ORIGIN" as const,

      code,

      label,

      page:
        544,

      section:
        `${SOURCE_SECTION_PREFIX} / C. ORIGIN – Transaction Source Values`,
    }),
  ),


  /*
   * D. CSTTYPE – CSTINFO Table
   * BlackBook v3.5 p.545
   */
  ...[
    ["0", "Browsers / Reports"],
    ["1", "Screen Forms"],
    ["2", "Templates (Prototypes)"],
    ["3", "User-Defined Global (General) Fields"],
    ["5", "Imports (ASCII / Excel)"],
    ["6", "Alerts (EDA)"],
    ["7", "Personal User Menu"],
    ["8", "S1 Scripts"],
    ["9", "Custom SDK Code Files"],
    ["10", "Classic Menu"],
    ["12", "Data Flow Rules"],
    ["13", "Data Flow Scenarios"],
    ["15", "Gadgets"],
    ["16", "Advanced JavaScript"],
    ["18", "SQL Scripts"],
    ["19", "Business Processes (BAM)"],
    ["20", "Retail Designer"],
    ["21", "S1 Smart Scripts"],
    ["92", "SelectTop (Max Entries)"],
    ["96", "Trace (Objects Log File)"],
    ["97", "Custom Designers"],
    ["98", "Database Version"],
    ["99", "User Rights"],
  ].map(
    ([code, label]) => ({
      registry:
        "CSTTYPE" as const,

      code,

      label,

      page:
        545,

      section:
        `${SOURCE_SECTION_PREFIX} / D. CSTTYPE (CSTINFO Table)`,
    }),
  ),
];


function normalize(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      " ",
    );
}


function codeMatches(
  configuredCode: string,
  requestedCode: string,
): boolean {
  if (
    configuredCode ===
    requestedCode
  ) {
    return true;
  }


  const range =
    configuredCode.match(
      /^(\d+)-(\d+)$/,
    );


  const requested =
    Number(
      requestedCode,
    );


  if (
    !range ||
    !Number.isInteger(
      requested,
    )
  ) {
    return false;
  }


  const from =
    Number(
      range[1],
    );

  const to =
    Number(
      range[2],
    );


  return (
    requested >= from &&
    requested <= to
  );
}


export function findSoftOneAppendixByCode(
  registry:
    SoftOneBlackBookAppendixRegistry,
  code:
    string | number,
): SoftOneBlackBookAppendixEntry[] {
  const requested =
    String(
      code,
    );


  return SOFTONE_BLACKBOOK_APPENDIX_ENTRIES.filter(
    entry =>
      entry.registry ===
        registry &&
      codeMatches(
        entry.code,
        requested,
      ),
  );
}


export function searchSoftOneAppendixRegistry(
  query: string,
  registry?:
    SoftOneBlackBookAppendixRegistry,
): SoftOneBlackBookAppendixEntry[] {
  const q =
    normalize(
      query,
    );


  return SOFTONE_BLACKBOOK_APPENDIX_ENTRIES
    .filter(
      entry =>
        !registry ||
        entry.registry ===
          registry,
    )
    .filter(
      entry =>
        normalize(
          entry.code,
        ).includes(
          q,
        ) ||
        normalize(
          entry.label,
        ).includes(
          q,
        ) ||
        normalize(
          entry.registry,
        ).includes(
          q,
        ),
    );
}
