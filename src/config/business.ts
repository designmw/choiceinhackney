/**
 * Per-client business details — edit this file for every new client project.
 * These values feed LocalBusinessSchema (home + contact) and can be pulled
 * into copy elsewhere via import.
 *
 * Common schema.org @type values:
 *   NGO | Organization  ← charities and non-profits
 *
 * Common schema.org @type values for local SMEs:
 *   Plumber | Electrician | HVACBusiness | Locksmith | Roofer
 *   Attorney | AccountingService | LegalService | FinancialService
 *   HairSalon | BeautySalon | DaySpa | HealthClub
 *   GeneralContractor | HomeAndConstructionBusiness
 *   MedicalBusiness | Dentist | Optician
 *   AutoRepair | CarDealer
 *   Restaurant | CafeOrCoffeeShop
 *   LocalBusiness  ← safe fallback for anything else
 *
 * image must be an absolute URL (e.g. https://example.com/og-business.jpg)
 * or a root-relative path that resolves once the site URL is set.
 */

export interface BusinessConfig {
  name: string;
  legalName?: string;
  /** schema.org @type — see list above */
  type: string;
  url: string;
  telephone: string;
  email?: string;
  address: {
    street: string;
    locality: string;
    region: string;
    postalCode: string;
    /** ISO 3166-1 alpha-2 country code */
    country: string;
  };
  /** Absolute URL or root-relative path to a representative image */
  image: string;
  description?: string;
  /** e.g. ["Mo-Fr 09:00-17:00", "Sa 09:00-13:00"] */
  openingHours?: string[];
  /** e.g. "€€" */
  priceRange?: string;
  /** Social profile URLs for sameAs */
  sameAs?: string[];
  /**
   * Aggregate review rating → ⭐ stars in Google results. ONLY set this with a
   * real rating that is also shown on the site (e.g. a Google/Trustpilot score
   * displayed in a testimonials section). Fabricated ratings breach Google's
   * guidelines and risk a manual penalty. Leave undefined if you have none.
   */
  aggregateRating?: {
    ratingValue: number;
    reviewCount: number;
  };
  /** Registered charity number, shown in the footer */
  charityNumber?: string;
  /** Companies House number, shown in the footer */
  companyNumber?: string;
}

export const business: BusinessConfig = {
  name: 'Choice in Hackney',
  legalName: 'Choice in Hackney',
  type: 'NGO',
  url: 'https://choiceinhackney.org',
  telephone: '020 7613 3206',
  email: 'info@choiceinhackney.org',
  address: {
    street: 'Marie Lloyd Centre, 329 Queensbridge Road',
    locality: 'London',
    region: 'Hackney',
    postalCode: 'E8 3LA',
    country: 'GB',
  },
  image: 'https://choiceinhackney.org/images/choice-in-hackney.jpg',
  description:
    'Choice in Hackney is a Disabled People User Led Organisation. We are run by disabled people, for disabled people, supporting disabled people across Hackney to live independently and with dignity.',
  openingHours: ['Mo-Fr 09:30-17:00'],
  sameAs: [
    'https://twitter.com/ChoiceinHackney',
    'https://www.facebook.com/choiceinhackney',
    'https://uk.linkedin.com/company/choice-in-hackney',
  ],
  // Charity registration — displayed in the footer.
  charityNumber: '1077287',
  companyNumber: '3423122',
};
