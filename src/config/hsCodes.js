/**
 * HS Code mapping for Rapid Roots
 * 
 * Only map items that CANNOT have HS codes
 * in Sage (GL accounts, service charges).
 * 
 * All inventory/product items must have
 * HS codes set in Sage item master so they
 * print on the invoice PDF automatically.
 * 
 * TODO before production:
 * Replace 12092500 with correct service
 * HS codes confirmed by ZIMRA.
 */

module.exports = {
  DESCRIPTION_MAP: {
    'labour':    '12092500',
    'labor':     '12092500',
    'transport': '12092500',
    'delivery':  '12092500',
    'compost':   '12092500',
  }
};
